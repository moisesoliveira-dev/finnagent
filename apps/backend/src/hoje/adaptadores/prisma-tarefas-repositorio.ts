import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { REPETICOES_DE_TAREFA, type PedidoDeMovimento, type PedidoDeTarefa, type RepeticaoDeTarefa, type Tarefa } from "@finnagent/contracts";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { proximaData } from "../dominio/repeticao.js";
import { ancestrais, descendentes, mudancasAoConcluir, ordemDepoisDeMover, podeMover } from "../dominio/subtarefas.js";
import type { TarefasRepositorio } from "../portas/tarefas-repositorio.js";

const selecao = { id: true, title: true, date: true, doneOn: true, position: true, parentId: true, repeat: true, appointmentId: true } as const;

type Transacao = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

@Injectable()
export class PrismaTarefasRepositorio implements TarefasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listarDoDia(tenantId: string, date: string, compromissos: string[]) {
    const dia = dataPrisma(date);
    // As atividades do dia (ou que ficaram de antes, ou feitas no dia) e toda a árvore abaixo de cada uma. O checklist
    // de um compromisso é só do dia da ocorrência: não fica para depois.
    const rows = await this.banco().task.findMany({
      where: {
        tenantId,
        OR: [
          { parentId: null, appointmentId: null, OR: [{ doneOn: null, date: { lte: dia } }, { doneOn: dia }] },
          ...(compromissos.length ? [{ parentId: null, appointmentId: { in: compromissos }, date: dia }] : []),
          { parentId: { not: null } },
        ],
      },
      orderBy: [{ date: "asc" }, { position: "asc" }],
      select: selecao,
    });
    const todas = rows.map(tarefaDe);
    const raizes = todas.filter((item) => item.parentId === null);
    const visiveis = new Set(raizes.flatMap((raiz) => [raiz.id, ...descendentes(todas, raiz.id)]));
    return todas.filter((item) => visiveis.has(item.id));
  }

  async criar(tenantId: string, id: string, pedido: PedidoDeTarefa) {
    return this.banco().$transaction(async (tx) => {
      if (await tx.task.findFirst({ where: { id, tenantId }, select: { id: true } })) return "identificador" as const;
      const parentId = pedido.parentId ?? null;
      const pai = parentId ? await tx.task.findFirst({ where: { id: parentId, tenantId }, select: { id: true, appointmentId: true, date: true } }) : null;
      if (parentId && !pai) return "pai-ausente" as const;
      // A subatividade herda o compromisso (e o dia) da atividade; a raiz só vale se o compromisso existe.
      const appointmentId = pai ? pai.appointmentId : (pedido.appointmentId ?? null);
      if (!pai && appointmentId && !(await tx.appointment.findFirst({ where: { id: appointmentId, tenantId }, select: { id: true } }))) {
        return "compromisso-ausente" as const;
      }
      const date = pai?.appointmentId ? dataIso(pai.date) : pedido.date;
      const ultima = await tx.task.aggregate({ where: { tenantId, parentId, ...(parentId ? {} : { appointmentId, ...(appointmentId ? { date: dataPrisma(date) } : {}) }) }, _max: { position: true } });
      // Só a raiz repete, e o checklist do compromisso não repete.
      const repeat = parentId || appointmentId ? null : (pedido.repeat ?? null);
      const criada = await tx.task.create({
        data: { id, tenantId, title: pedido.title, date: dataPrisma(date), position: (ultima._max.position ?? -1) + 1, parentId, repeat, appointmentId },
        select: selecao,
      });
      await gravarOutbox(tx, tenantId, "criar-tarefa", id, { id, ...pedido, date, parentId, repeat, appointmentId }, marcaDe(pedido));
      return tarefaDe(criada);
    });
  }

  async atualizar(tenantId: string, id: string, pedido: PedidoDeTarefa) {
    return this.banco().$transaction(async (tx) => {
      const atual = await tx.task.findFirst({ where: { id, tenantId }, select: { parentId: true, appointmentId: true } });
      if (!atual) return "ausente" as const;
      // O item do checklist de um compromisso fica no dia da ocorrência e não repete: só o texto muda.
      const doCompromisso = Boolean(atual.appointmentId);
      const repeat = atual.parentId || doCompromisso ? null : pedido.repeat === undefined ? undefined : pedido.repeat;
      const mudadas = await tx.task.updateMany({
        where: { id, tenantId },
        data: { title: pedido.title, ...(doCompromisso ? {} : { date: dataPrisma(pedido.date) }), ...(repeat === undefined ? {} : { repeat }) },
      });
      if (mudadas.count !== 1) return "ausente" as const;
      const salva = await tx.task.findFirstOrThrow({ where: { id, tenantId }, select: selecao });
      await gravarOutbox(tx, tenantId, "atualizar-tarefa", id, { id, title: pedido.title, date: pedido.date, repeat: salva.repeat }, marcaDe(pedido));
      return tarefaDe(salva);
    });
  }

  async concluir(tenantId: string, id: string, doneOn: string | null) {
    return this.banco().$transaction(async (tx) => {
      const alvo = await tx.task.findFirst({ where: { id, tenantId }, select: selecao });
      if (!alvo) return "ausente" as const;
      const arvore = await this.arvoreDe(tx, tenantId, id);
      const mudancas = mudancasAoConcluir(arvore, id, doneOn);
      for (const mudanca of mudancas) {
        await tx.task.updateMany({ where: { id: mudanca.id, tenantId }, data: { doneOn: mudanca.doneOn ? dataPrisma(mudanca.doneOn) : null } });
      }
      // A raiz que repete e acabou de ser feita nasce de novo no próximo dia da regra, com as subatividades abertas.
      const proximas: { id: string; date: string }[] = [];
      for (const mudanca of mudancas) {
        const feita = arvore.find((item) => item.id === mudanca.id);
        if (!mudanca.doneOn || !feita || feita.parentId !== null || !feita.repeat) continue;
        proximas.push(await this.renascer(tx, tenantId, arvore, feita, mudanca.doneOn));
      }
      const salva = await tx.task.findFirstOrThrow({ where: { id, tenantId }, select: selecao });
      const payload = { id, doneOn, tambem: mudancas.filter((item) => item.id !== id), proximas };
      await gravarOutbox(tx, tenantId, "concluir-tarefa", id, payload, marcaDe(payload));
      return tarefaDe(salva);
    });
  }

  async mover(tenantId: string, id: string, pedido: PedidoDeMovimento) {
    return this.banco().$transaction(async (tx) => {
      const alvo = await tx.task.findFirst({ where: { id, tenantId }, select: selecao });
      if (!alvo) return "ausente" as const;
      const parentId = pedido.parentId ?? null;
      const pai = parentId ? await tx.task.findFirst({ where: { id: parentId, tenantId }, select: { id: true, appointmentId: true, date: true } }) : null;
      if (parentId && !pai) return "pai-ausente" as const;
      const arvore = await this.arvoreDe(tx, tenantId, id);
      if (!podeMover(arvore, id, parentId)) return "ciclo" as const;
      // Na raiz, a tarefa pode trocar de lista: para o checklist de um compromisso, ou de volta para as soltas.
      const trocaDeLista = !parentId && pedido.appointmentId !== undefined;
      if (trocaDeLista && pedido.appointmentId && !(await tx.appointment.findFirst({ where: { id: pedido.appointmentId, tenantId }, select: { id: true } }))) {
        return "compromisso-ausente" as const;
      }
      const destino = trocaDeLista
        ? { appointmentId: pedido.appointmentId ?? null, date: pedido.date ? dataPrisma(pedido.date) : alvo.date }
        : { appointmentId: alvo.appointmentId, date: alvo.date };
      if (trocaDeLista) {
        const ids = [id, ...descendentes(arvore, id)];
        // O checklist não repete: a tarefa que repetia deixa de repetir ao entrar nele.
        await tx.task.updateMany({ where: { tenantId, id: { in: ids } }, data: { appointmentId: destino.appointmentId, date: destino.date } });
        if (destino.appointmentId) await tx.task.updateMany({ where: { id, tenantId }, data: { repeat: null } });
      }
      // Na raiz, as irmãs são as da mesma lista: as soltas, ou o checklist do mesmo compromisso no mesmo dia.
      const irmas = await tx.task.findMany({
        where: { tenantId, parentId, ...(parentId ? {} : { appointmentId: destino.appointmentId, ...(destino.appointmentId ? { date: destino.date } : {}) }) },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const ordem = ordemDepoisDeMover(irmas.map((item) => item.id), id, pedido.beforeId ?? null);
      await tx.task.updateMany({ where: { id, tenantId }, data: { parentId } });
      // Entrar numa atividade leva a tarefa, e a árvore dela, para a lista dessa atividade (solta ou de um compromisso).
      if (pai && pai.appointmentId !== alvo.appointmentId) {
        const ids = [id, ...descendentes(arvore, id)];
        await tx.task.updateMany({ where: { tenantId, id: { in: ids } }, data: { appointmentId: pai.appointmentId, ...(pai.appointmentId ? { date: pai.date } : {}) } });
      }
      for (const [posicao, idDaIrma] of ordem.entries()) {
        await tx.task.updateMany({ where: { id: idDaIrma, tenantId }, data: { position: posicao } });
      }
      const salva = await tx.task.findFirstOrThrow({ where: { id, tenantId }, select: selecao });
      const payload = {
        id,
        parentId,
        beforeId: pedido.beforeId ?? null,
        ordem,
        ...(trocaDeLista ? { appointmentId: destino.appointmentId, date: dataIso(destino.date) } : {}),
      };
      await gravarOutbox(tx, tenantId, "mover-tarefa", id, payload, marcaDe(payload));
      return tarefaDe(salva);
    });
  }

  async excluir(tenantId: string, id: string) {
    return this.banco().$transaction(async (tx) => {
      const apagadas = await tx.task.deleteMany({ where: { id, tenantId } });
      if (apagadas.count !== 1) return "ausente" as const;
      await gravarOutbox(tx, tenantId, "excluir-tarefa", id, { id });
    });
  }

  async copiarChecklist(tenantId: string, appointmentId: string, date: string) {
    return this.banco().$transaction(async (tx) => {
      const dia = dataPrisma(date);
      if (await tx.task.findFirst({ where: { tenantId, appointmentId, parentId: null, date: dia }, select: { id: true } })) return "ja-tem" as const;
      const ultima = await tx.task.findFirst({
        where: { tenantId, appointmentId, parentId: null, date: { lt: dia } },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      if (!ultima) return "sem-anterior" as const;
      const todas = (await tx.task.findMany({ where: { tenantId }, select: selecao })).map(tarefaDe);
      const raizes = todas.filter((item) => item.appointmentId === appointmentId && item.parentId === null && item.date === dataIso(ultima.date));
      const criadas: string[] = [];
      const copiar = async (de: Tarefa, paraPai: string | null) => {
        const novaId = randomUUID();
        await tx.task.create({
          data: { id: novaId, tenantId, title: de.title, date: dia, position: de.position, parentId: paraPai, repeat: null, appointmentId },
        });
        criadas.push(novaId);
        for (const filha of todas.filter((item) => item.parentId === de.id).sort((a, b) => a.position - b.position)) await copiar(filha, novaId);
      };
      for (const raiz of raizes.sort((a, b) => a.position - b.position)) await copiar(raiz, null);
      const payload = { appointmentId, date, de: dataIso(ultima.date), criadas };
      await gravarOutbox(tx, tenantId, "copiar-checklist", `${appointmentId}:${date}`, payload, marcaDe(payload));
      const salvas = await tx.task.findMany({ where: { tenantId, id: { in: criadas } }, select: selecao });
      return salvas.map(tarefaDe);
    });
  }

  /** Cria a próxima ocorrência de uma tarefa que repete: a raiz no próximo dia e a árvore abaixo dela, toda aberta. */
  private async renascer(tx: Transacao, tenantId: string, arvore: Tarefa[], feita: Tarefa, doneOn: string) {
    const date = proximaData(feita.date, feita.repeat as RepeticaoDeTarefa, doneOn);
    const ultima = await tx.task.aggregate({ where: { tenantId, parentId: null }, _max: { position: true } });
    const novaRaiz = randomUUID();
    await tx.task.create({
      data: { id: novaRaiz, tenantId, title: feita.title, date: dataPrisma(date), position: (ultima._max.position ?? -1) + 1, parentId: null, repeat: feita.repeat },
    });
    const copiar = async (deId: string, paraId: string) => {
      const filhas = arvore.filter((item) => item.parentId === deId).sort((a, b) => a.position - b.position);
      for (const filha of filhas) {
        const novaId = randomUUID();
        await tx.task.create({
          data: { id: novaId, tenantId, title: filha.title, date: dataPrisma(date), position: filha.position, parentId: paraId, repeat: null },
        });
        await copiar(filha.id, novaId);
      }
    };
    await copiar(feita.id, novaRaiz);
    return { id: novaRaiz, date };
  }

  /** A família inteira de uma tarefa: da raiz a todos os descendentes. */
  private async arvoreDe(tx: Transacao, tenantId: string, id: string) {
    const todas = (await tx.task.findMany({ where: { tenantId }, select: selecao })).map(tarefaDe);
    const acima = ancestrais(todas, id);
    const raiz = acima[acima.length - 1] ?? id;
    const ids = new Set([raiz, ...descendentes(todas, raiz)]);
    return todas.filter((item) => ids.has(item.id));
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function dataPrisma(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dataIso(data: Date) {
  return data.toISOString().slice(0, 10);
}

function tarefaDe(row: {
  id: string;
  title: string;
  date: Date;
  doneOn: Date | null;
  position: number;
  parentId: string | null;
  repeat: string | null;
  appointmentId: string | null;
}): Tarefa {
  return {
    id: row.id,
    title: row.title,
    date: dataIso(row.date),
    doneOn: row.doneOn ? dataIso(row.doneOn) : null,
    position: row.position,
    parentId: row.parentId,
    repeat: (REPETICOES_DE_TAREFA as readonly string[]).includes(row.repeat ?? "") ? (row.repeat as RepeticaoDeTarefa) : null,
    appointmentId: row.appointmentId,
  };
}
