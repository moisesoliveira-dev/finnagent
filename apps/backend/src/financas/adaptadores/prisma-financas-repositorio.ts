import { Injectable } from "@nestjs/common";
import {
  alterouIdentidade,
  alterouTermos,
  aplicarStatusNoConjunto,
  categoriaDeCompromisso,
  centavosComSinal,
  gradeDoLancamento,
  parcelaAtual,
  proximoVencimento,
  statusAgregado,
  termosTravados,
  transicaoDaOcorrencia,
  type CategoriaTransacao,
  type EfeitoTransacao,
  type Lancamento,
  type ModoTransacao,
  type Ocorrencia,
  type PrioridadeTransacao,
  type StatusTransacao,
  type Recorrencia,
  type TipoLancamento,
  type TipoTransacao,
} from "@finnagent/contracts";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { categoriaPermitida, protegeValorBase } from "../../grupos/dominio/sessao.js";
import type { TipoSessao } from "@finnagent/contracts";
import { EXEMPLO, WORKFLOW_INICIAL } from "../dominio/exemplo.js";
import type { Prisma } from "@prisma/client";
import { ocorrenciaDoPagamento, pagarOcorrencia } from "../dominio/pagamento.js";
import { jurosEmPontos, percentualDeJuros } from "../dominio/transacao.js";
import { removerDaLinha } from "../dominio/vista.js";
import type {
  FinancasRepositorio,
  NovoLancamento,
  ValorFixo,
} from "../portas/financas-repositorio.js";

@Injectable()
export class PrismaFinancasRepositorio implements FinancasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async garantirWorkflow(tenantId: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.workflow.findUnique({ where: { tenantId } });
      if (atual) return { year: atual.year, month: atual.month, day: atual.day };
      const criado = await tx.workflow.create({
        data: { tenantId, ...WORKFLOW_INICIAL },
      });
      await gravarOutbox(tx, tenantId, "definir-workflow", tenantId, WORKFLOW_INICIAL);
      return { year: criado.year, month: criado.month, day: criado.day };
    });
  }

  async semearLancamentos(tenantId: string) {
    const db = this.banco();
    await db.$transaction(async (tx) => {
      for (const [position, item] of EXEMPLO.entries()) {
        const existente = await tx.entry.findFirst({ where: { id: item.id, tenantId } });
        if (existente) continue;
        await tx.entry.create({
          data: {
            id: item.id,
            tenantId,
            sessionId: item.sessionId,
            type: item.type,
            description: item.description,
            justification: item.justification,
            day: item.day,
            cents: item.cents,
            startYear: item.startYear,
            startMonth: item.startMonth,
            installments: item.installments,
            position,
            ...gravacao(item),
            amounts: { create: item.months },
          },
        });
        await gravarOutbox(tx, tenantId, "criar-lancamento", item.id, item, marcaDe(item));
      }
    });
  }

  async listar(tenantId: string, incluirEncerradas = false) {
    const db = this.banco();
    const workflow = await db.workflow.findUnique({ where: { tenantId } });
    const rows = await db.entry.findMany({
      where: {
        tenantId,
        ...(incluirEncerradas ? {} : { session: { endedAt: null } }),
      },
      orderBy: { position: "asc" },
      include: {
        amounts: {
          where: { tenantId },
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
        adjustments: { where: { tenantId } },
        occurrences: { where: { tenantId }, orderBy: { number: "asc" } },
        session: { include: { group: true } },
        statementLines: { where: { tenantId }, select: { line: true }, take: 1 },
      },
    });
    return {
      workflow: workflow
        ? { year: workflow.year, month: workflow.month, day: workflow.day }
        : WORKFLOW_INICIAL,
      entries: rows.map(lancamentoDe),
    };
  }

  async obter(tenantId: string, id: string) {
    const row = await this.buscar(this.banco(), tenantId, id);
    return row ? lancamentoDe(row) : null;
  }

  async criar(tenantId: string, pedido: NovoLancamento) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.entry.findFirst({
        where: { id: pedido.id, tenantId },
        include: {
          amounts: { where: { tenantId } },
          adjustments: { where: { tenantId } },
          occurrences: { where: { tenantId }, orderBy: { number: "asc" } },
          session: { include: { group: true } },
        },
      });
      if (atual) {
        if (mesmoLancamento(atual, pedido)) return lancamentoDe(atual);
        return "identificador" as const;
      }
      const recusa = await recusaDaSessao(tx, tenantId, pedido.sessionId, pedido.category);
      if (recusa) return recusa;
      const ultimo = await tx.entry.aggregate({
        where: { tenantId },
        _max: { position: true },
      });
      const meses = mesesDoPedido(pedido);
      const criado = await tx.entry.create({
        data: {
          id: pedido.id,
          tenantId,
          sessionId: pedido.sessionId,
          type: pedido.type,
          description: pedido.description,
          justification: pedido.justification,
          day: pedido.day,
          cents: pedido.cents,
          startYear: pedido.startYear,
          startMonth: pedido.startMonth,
          installments: pedido.installments,
          position: (ultimo._max.position ?? -1) + 1,
          ...gravacao(pedido),
          amounts: { create: meses },
          occurrences: { create: gradeDoPedido(pedido).map(dadosAninhados) },
        },
        include: {
          amounts: { where: { tenantId } },
          adjustments: { where: { tenantId } },
          occurrences: { where: { tenantId }, orderBy: { number: "asc" } },
          session: { include: { group: true } },
        },
      });
      await gravarOutbox(
        tx,
        tenantId,
        "criar-lancamento",
        pedido.id,
        { ...pedido, months: meses },
        marcaDe({ ...pedido, months: meses }),
      );
      return lancamentoDe(criado);
    });
  }

  async atualizar(tenantId: string, pedido: NovoLancamento) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await this.buscar(tx, tenantId, pedido.id);
      if (!atual) return "ausente" as const;
      if (igual(atual, pedido)) return lancamentoDe(atual);
      if (alterouIdentidade(baseDaLinha(atual), pedido)) return "base" as const;
      const regenerar = alterouTermos(termosDaLinha(atual), termosDoPedido(pedido));
      if (
        regenerar &&
        termosTravados(efetivasDaLinha(atual), (atual.statementLines?.length ?? 0) > 0)
      ) {
        return "ocorrencia" as const;
      }
      const recusa = await recusaDaSessao(tx, tenantId, pedido.sessionId, pedido.category, {
        id: atual.id,
        cents: atual.cents,
        mode: atual.mode,
        pedidoCents: pedido.cents,
        pedidoMode: pedido.mode,
      });
      if (recusa) return recusa;
      const meses = mesesDoPedido(pedido);
      await tx.entry.updateMany({
        where: { id: pedido.id, tenantId },
        data: {
          sessionId: pedido.sessionId,
          type: pedido.type,
          description: pedido.description,
          justification: pedido.justification,
          day: pedido.day,
          cents: pedido.cents,
          startYear: pedido.startYear,
          startMonth: pedido.startMonth,
          installments: pedido.installments,
          ...atributos(pedido),
          ...(pedido.category === "fixed" && !regenerar ? {} : { suspendedCents: 0 }),
          ...(regenerar ? resumoGravado(pedido, gradeDoPedido(pedido)) : {}),
        },
      });
      await tx.entryAmount.deleteMany({ where: { entryId: pedido.id, tenantId } });
      if (meses.length > 0) {
        await tx.entryAmount.createMany({
          data: meses.map((mes) => ({ ...mes, entryId: pedido.id, tenantId })),
        });
      }
      if (pedido.category !== "fixed" || regenerar) {
        await tx.entryAdjustment.deleteMany({ where: { entryId: pedido.id, tenantId } });
      }
      if (regenerar) {
        await this.substituir(tx, tenantId, pedido.id, gradeDoPedido(pedido));
      }
      const salvo = await this.buscar(tx, tenantId, pedido.id);
      if (!salvo) throw new Error("Lançamento ausente depois de gravar a atualização.");
      await gravarOutbox(
        tx,
        tenantId,
        "atualizar-lancamento",
        pedido.id,
        { ...pedido, months: meses },
        marcaDe({ ...pedido, months: meses }),
      );
      return lancamentoDe(salvo);
    });
  }

  async atualizarStatus(tenantId: string, id: string, status: StatusTransacao) {
    return this.alterar(tenantId, id, "atualizar-status-lancamento", async (tx, atual) => {
      const lista = await this.materializar(tx, tenantId, atual);
      const proxima = aplicarStatusNoConjunto(lista, status);
      if (igualLista(lista, proxima)) return { status: atual.status };
      await this.substituir(tx, tenantId, id, proxima);
      await this.resumir(tx, tenantId, atual, proxima);
      await this.alinharAjustes(tx, tenantId, atual, proxima);
      return { status: statusAgregado(proxima) };
    });
  }

  async atualizarOcorrencia(
    tenantId: string,
    id: string,
    number: number,
    pedido: { status?: StatusTransacao; dueDate?: string; plannedCents?: number },
  ) {
    return this.alterar(tenantId, id, "atualizar-ocorrencia", async (tx, atual) => {
      const lista = await this.materializar(tx, tenantId, atual);
      const indice = lista.findIndex((item) => item.number === number);
      const alvo = lista[indice];
      if (!alvo) return "ausente" as const;
      const mexeValor = pedido.dueDate != null || pedido.plannedCents != null;
      if (mexeValor && ((atual.statementLines?.length ?? 0) > 0 || alvo.status !== "pending")) {
        return "bloqueada" as const;
      }
      let proxima = alvo;
      if (pedido.plannedCents != null) {
        if (pedido.plannedCents === 0) return "bloqueada" as const;
        proxima = {
          ...proxima,
          plannedCents: centavosComSinal(pedido.plannedCents, atual.mode as ModoTransacao),
        };
      }
      if (pedido.dueDate) proxima = { ...proxima, dueDate: pedido.dueDate };
      if (pedido.status) {
        const transicao = transicaoDaOcorrencia(proxima, pedido.status);
        if (transicao === "bloqueada") return "bloqueada" as const;
        proxima = transicao;
      }
      if (proxima.status === "completed") {
        proxima = { ...proxima, paidCents: proxima.plannedCents, paidOn: proxima.paidOn ?? proxima.dueDate };
      }
      lista[indice] = proxima;
      await this.substituir(tx, tenantId, id, lista);
      await this.resumir(tx, tenantId, atual, lista);
      await this.alinharAjustes(tx, tenantId, atual, lista);
      return { number, status: proxima.status, dueDate: proxima.dueDate, plannedCents: proxima.plannedCents };
    });
  }

  async pagarPeloExtrato(tenantId: string, id: string, date: string, cents: number) {
    return this.alterar(tenantId, id, "pagar-pelo-extrato", async (tx, atual) => {
      const lista = await this.materializar(tx, tenantId, atual);
      const number = ocorrenciaDoPagamento(lista, date);
      if (number == null) return "bloqueada" as const;
      const proxima = lista.map((item) => (item.number === number ? pagarOcorrencia(item, cents, date) : item));
      await this.substituir(tx, tenantId, id, proxima);
      await this.resumir(tx, tenantId, atual, proxima);
      await this.alinharAjustes(tx, tenantId, atual, proxima);
      await this.marcarCompromissos(tx, tenantId, id, date, "done");
      return { number, paidCents: cents, paidOn: date };
    });
  }

  async reabrirPeloExtrato(tenantId: string, id: string, date: string, cents: number) {
    return this.alterar(tenantId, id, "reabrir-pelo-extrato", async (tx, atual) => {
      const lista = await this.materializar(tx, tenantId, atual);
      const paga = lista
        .filter((item) => item.status === "completed" && item.paidOn === date && item.paidCents === cents)
        .at(-1);
      if (!paga) return "bloqueada" as const;
      const proxima = lista.map((item) =>
        item.number === paga.number ? { ...item, status: "pending" as const, paidCents: null, paidOn: null } : item,
      );
      await this.substituir(tx, tenantId, id, proxima);
      await this.resumir(tx, tenantId, atual, proxima);
      await this.alinharAjustes(tx, tenantId, atual, proxima);
      await this.marcarCompromissos(tx, tenantId, id, date, "undone");
      return { number: paga.number, status: "pending" as const };
    });
  }

  // O compromisso ligado ao lançamento acompanha o pagamento do mês dele.
  private async marcarCompromissos(
    tx: Prisma.TransactionClient,
    tenantId: string,
    entryId: string,
    date: string,
    status: "done" | "undone",
  ) {
    const [year, month] = date.split("-").map(Number);
    const alvos = await tx.appointment.findMany({
      where: { tenantId, entryId, year, month, status: { not: status } },
      select: { id: true },
    });
    for (const { id } of alvos) {
      await tx.appointment.updateMany({ where: { id, tenantId }, data: { status } });
      const payload = { id, status };
      await gravarOutbox(tx, tenantId, "atualizar-status-compromisso", id, payload, marcaDe({ ...payload, em: Date.now() }));
    }
  }

  async associarCompromisso(tenantId: string, id: string, commitmentId: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await this.buscar(tx, tenantId, id);
      if (!atual) return "ausente" as const;
      if (atual.commitmentId === commitmentId) return lancamentoDe(atual);
      const compromisso = await tx.appointment.findFirst({ where: { id: commitmentId, tenantId } });
      if (!compromisso) return "compromisso-ausente" as const;
      if (compromisso.entryId && compromisso.entryId !== id) {
        const outra = await tx.entry.findFirst({
          where: { id: compromisso.entryId, tenantId },
          select: { category: true },
        });
        await tx.entry.updateMany({
          where: { id: compromisso.entryId, tenantId, commitmentId },
          data: {
            commitmentId: null,
            transactionType:
              outra && categoriaDeCompromisso(outra.category as CategoriaTransacao)
                ? "appointment"
                : "unusual",
          },
        });
      }
      await tx.appointment.updateMany({
        where: { tenantId, entryId: id, NOT: { id: commitmentId } },
        data: { entryId: null },
      });
      await tx.appointment.updateMany({
        where: { id: commitmentId, tenantId },
        data: { entryId: id },
      });
      await tx.entry.updateMany({
        where: { id, tenantId },
        data: { commitmentId, transactionType: "appointment" },
      });
      const salvo = await this.buscar(tx, tenantId, id);
      if (!salvo) throw new Error("Lançamento ausente depois de associar o compromisso.");
      await gravarOutbox(
        tx,
        tenantId,
        "associar-compromisso",
        id,
        { id, commitmentId },
        commitmentId,
      );
      return lancamentoDe(salvo);
    });
  }

  async adiantar(tenantId: string, id: string, category: "installment" | "loan") {
    const operacao = category === "installment" ? "adiantar-parcelas" : "adiantar-emprestimo";
    return this.alterar(tenantId, id, operacao, async (tx, atual) => {
      if (atual.category !== category) return "categoria" as const;
      const lista = await this.materializar(tx, tenantId, atual);
      const indice = lista.findIndex((item) => item.status === "pending");
      const alvo = lista[indice];
      if (!alvo) {
        return lista.some((item) => item.status === "completed")
          ? ("concluida" as const)
          : ("encerrada" as const);
      }
      const transicao = transicaoDaOcorrencia(alvo, "completed");
      if (transicao === "bloqueada") return "encerrada" as const;
      lista[indice] = transicao;
      await this.substituir(tx, tenantId, id, lista);
      await this.resumir(tx, tenantId, atual, lista);
      return { installmentNumber: transicao.number, status: transicao.status };
    });
  }

  async cancelarSerie(tenantId: string, id: string, category: "installment" | "loan") {
    const operacao = category === "installment" ? "cancelar-parcelas" : "cancelar-emprestimo";
    return this.alterar(tenantId, id, operacao, async (tx, atual) => {
      if (atual.category !== category) return "categoria" as const;
      const lista = await this.materializar(tx, tenantId, atual);
      const proxima = aplicarStatusNoConjunto(lista, "cancelled");
      if (igualLista(lista, proxima)) return {};
      await this.substituir(tx, tenantId, id, proxima);
      await this.resumir(tx, tenantId, atual, proxima);
      return { status: statusAgregado(proxima) };
    });
  }

  async ajustarMes(
    tenantId: string,
    id: string,
    year: number,
    month: number,
    effect: EfeitoTransacao,
  ) {
    const operacao = effect === "cancelled" ? "cancelar-fixo" : "suspender-fixo";
    return this.alterar(tenantId, id, operacao, async (tx, atual) => {
      if (atual.category !== "fixed") return "categoria" as const;
      const ja = atual.adjustments.find((ajuste) => ajuste.year === year && ajuste.month === month);
      if (ja?.effect === effect) return { year, month, effect };
      const lista = await this.materializar(tx, tenantId, atual);
      const proxima = lista.map((item) => {
        const [ano, mes] = item.dueDate.split("-").map(Number);
        if (ano !== year || mes !== month || item.status === "cancelled") return item;
        return { ...item, status: "cancelled" as const, paidCents: null, paidOn: null };
      });
      if (!igualLista(lista, proxima)) {
        await this.substituir(tx, tenantId, id, proxima);
        await this.resumir(tx, tenantId, atual, proxima);
      }
      await tx.entryAdjustment.upsert({
        where: { entryId_year_month: { entryId: id, year, month } },
        create: { entryId: id, tenantId, year, month, effect },
        update: { effect },
      });
      if (effect === "suspended" && ja?.effect !== "suspended") {
        await tx.entry.updateMany({
          where: { id, tenantId },
          data: { suspendedCents: atual.suspendedCents + Math.abs(atual.cents) },
        });
      }
      return { year, month, effect };
    });
  }

  async atualizarValorFixo(tenantId: string, valores: ValorFixo[]) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      for (const valor of valores) {
        const atual = await this.buscar(tx, tenantId, valor.id);
        if (!atual) return "ausente" as const;
        if (atual.category !== "fixed") return "categoria" as const;
      }
      const salvos = [];
      for (const valor of valores) {
        const atual = await this.buscar(tx, tenantId, valor.id);
        if (!atual) return "ausente" as const;
        const cents = centavosComSinal(Math.abs(valor.cents), atual.mode as ModoTransacao);
        await tx.entry.updateMany({
          where: { id: valor.id, tenantId },
          data: { cents },
        });
        const lista = await this.materializar(tx, tenantId, atual);
        const proxima = lista.map((item) =>
          item.status === "pending" ? { ...item, plannedCents: cents } : item,
        );
        await this.substituir(tx, tenantId, valor.id, proxima);
        const salvo = await this.buscar(tx, tenantId, valor.id);
        if (!salvo) throw new Error("Lançamento ausente depois de gravar o valor fixo.");
        salvos.push(lancamentoDe(salvo));
      }
      await gravarOutbox(
        tx,
        tenantId,
        "atualizar-valor-fixo",
        valores.map((valor) => valor.id).join(","),
        { valores },
        marcaDe(valores),
      );
      return salvos;
    });
  }

  private async alterar(
    tenantId: string,
    id: string,
    operacao: string,
    aplicar: (tx: Prisma.TransactionClient, atual: Linha) => Promise<Record<string, unknown> | FalhaCurta>,
  ) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await this.buscar(tx, tenantId, id);
      if (!atual) return "ausente" as const;
      const mudanca = await aplicar(tx, atual);
      if (typeof mudanca === "string") return mudanca;
      const salvo = await this.buscar(tx, tenantId, id);
      if (!salvo) throw new Error("Lançamento ausente depois de gravar a alteração.");
      const payload = { id, ...mudanca };
      await gravarOutbox(tx, tenantId, operacao, id, payload, marcaDe(payload));
      return lancamentoDe(salvo);
    });
  }

  private buscar(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    return tx.entry.findFirst({
      where: { id, tenantId },
      include: {
        amounts: { where: { tenantId } },
        adjustments: { where: { tenantId } },
        occurrences: { where: { tenantId }, orderBy: { number: "asc" } },
        session: { include: { group: true } },
        statementLines: { where: { tenantId }, select: { line: true }, take: 1 },
      },
    });
  }

  private async materializar(tx: Prisma.TransactionClient, tenantId: string, atual: Linha) {
    const gravadas = atual.occurrences ?? [];
    if (gravadas.length > 0) return gravadas.map(ocorrenciaDe);
    const grade = gradeDoLancamento(contratoDaLinha(atual));
    if (grade.length > 0) {
      await tx.entryOccurrence.createMany({
        data: grade.map((item) => dadosOcorrencia(tenantId, atual.id, item)),
      });
    }
    return grade;
  }

  private async substituir(tx: Prisma.TransactionClient, tenantId: string, entryId: string, lista: Ocorrencia[]) {
    await tx.entryOccurrence.deleteMany({ where: { tenantId, entryId } });
    if (lista.length === 0) return;
    await tx.entryOccurrence.createMany({
      data: lista.map((item) => dadosOcorrencia(tenantId, entryId, item)),
    });
  }

  private async alinharAjustes(
    tx: Prisma.TransactionClient,
    tenantId: string,
    atual: Linha,
    lista: Ocorrencia[],
  ) {
    if (atual.category !== "fixed") return;
    const porMes = new Map<string, Ocorrencia[]>();
    for (const item of lista) {
      const [year, month] = item.dueDate.split("-").map(Number);
      const chave = `${year}-${month}`;
      const grupo = porMes.get(chave) ?? [];
      grupo.push(item);
      porMes.set(chave, grupo);
    }
    for (const ajuste of atual.adjustments) {
      const grupo = porMes.get(`${ajuste.year}-${ajuste.month}`) ?? [];
      const segueCancelado = grupo.length > 0 && grupo.every((item) => item.status === "cancelled");
      if (segueCancelado) continue;
      await tx.entryAdjustment.deleteMany({
        where: { tenantId, entryId: atual.id, year: ajuste.year, month: ajuste.month },
      });
    }
    const restantes = await tx.entryAdjustment.findMany({ where: { tenantId, entryId: atual.id } });
    const suspenso =
      restantes.filter((ajuste) => ajuste.effect === "suspended").length * Math.abs(atual.cents);
    if (suspenso !== atual.suspendedCents) {
      await tx.entry.updateMany({
        where: { id: atual.id, tenantId },
        data: { suspendedCents: suspenso },
      });
    }
  }

  private async resumir(tx: Prisma.TransactionClient, tenantId: string, atual: Linha, lista: Ocorrencia[]) {
    const parcelado = atual.category === "installment" || atual.category === "loan";
    const proximo = proximoVencimento(lista);
    await tx.entry.updateMany({
      where: { id: atual.id, tenantId },
      data: {
        status: statusAgregado(lista),
        ...(parcelado ? { installmentNumber: parcelaAtual(lista) } : {}),
        ...(atual.category === "fixed" ? { nextDueOn: proximo ? dataPrisma(proximo) : null } : {}),
      },
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }

  async excluir(tenantId: string, id: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.entry.findFirst({
        where: { id, tenantId },
        select: { id: true, _count: { select: { statementLines: true } } },
      });
      if (!atual) return "ausente" as const;
      if (atual._count.statementLines > 0) return "sincronizado" as const;
      await tx.appointment.updateMany({ where: { tenantId, entryId: id }, data: { entryId: null } });
      await tx.entry.deleteMany({ where: { id, tenantId } });
      await gravarOutbox(tx, tenantId, "excluir-lancamento", id, { id });
    });
  }

  async excluirOcorrencia(tenantId: string, id: string, number: number) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await this.buscar(tx, tenantId, id);
      if (!atual) return "ausente" as const;
      if ((atual.statementLines?.length ?? 0) > 0) return "sincronizado" as const;
      const lista = efetivasDaLinha(atual);
      const alvo = lista.find((item) => item.number === number);
      if (!alvo) return "ausente" as const;
      const remocao = removerDaLinha(lancamentoDe(atual), lista, alvo);
      if (remocao === null) return "bloqueada" as const;
      if (remocao === "entry") {
        await tx.appointment.updateMany({ where: { tenantId, entryId: id }, data: { entryId: null } });
        await tx.entry.deleteMany({ where: { id, tenantId } });
        await gravarOutbox(tx, tenantId, "excluir-lancamento", id, { id });
        return "entry" as const;
      }
      const materializada = await this.materializar(tx, tenantId, atual);
      const indice = materializada.findIndex((item) => item.number === number);
      const transicao = materializada[indice] ? transicaoDaOcorrencia(materializada[indice], "cancelled") : "bloqueada";
      if (transicao === "bloqueada") return "bloqueada" as const;
      materializada[indice] = transicao;
      await this.substituir(tx, tenantId, id, materializada);
      await this.resumir(tx, tenantId, atual, materializada);
      await this.alinharAjustes(tx, tenantId, atual, materializada);
      const payload = { id, number };
      await gravarOutbox(tx, tenantId, "excluir-ocorrencia", id, payload, marcaDe(payload));
      return "occurrence" as const;
    });
  }
}

function mesesDoPedido(pedido: NovoLancamento) {
  if (pedido.type === "adicional" || pedido.type === "variável") {
    return [{ year: pedido.startYear, month: pedido.startMonth, cents: pedido.cents }];
  }
  return [];
}

function mesmoLancamento(
  atual: {
    sessionId: string;
    type: string;
    description: string;
    justification: string;
    day: number;
    cents: number;
    startYear: number;
    startMonth: number;
    installments: number | null;
    amounts: { year: number; month: number; cents: number }[];
  },
  pedido: NovoLancamento,
) {
  const meses = mesesDoPedido(pedido);
  const campos =
    atual.sessionId === pedido.sessionId &&
    atual.type === pedido.type &&
    atual.description === pedido.description &&
    atual.justification === pedido.justification &&
    atual.day === pedido.day &&
    atual.cents === pedido.cents &&
    atual.startYear === pedido.startYear &&
    atual.startMonth === pedido.startMonth &&
    atual.installments === pedido.installments &&
    atual.amounts.length === meses.length;
  if (!campos) return false;
  return meses.every((mes) =>
    atual.amounts.some(
      (item) => item.year === mes.year && item.month === mes.month && item.cents === mes.cents,
    ),
  );
}

type FalhaCurta = "categoria" | "encerrada" | "concluida" | "bloqueada" | "ausente";

type Linha = {
  id: string;
  sessionId: string;
  type: string;
  description: string;
  justification: string;
  day: number;
  cents: number;
  startYear: number;
  startMonth: number;
  installments: number | null;
  name: string;
  occurredOn: Date;
  mode: string;
  status: string;
  transactionType: string;
  category: string;
  priority: string;
  installmentNumber: number | null;
  dueOn: Date | null;
  interestBps: number | null;
  nextDueOn: Date | null;
  suspendedCents: number;
  commitmentId: string | null;
  recurrence: string | null;
  recurrenceInterval: number | null;
  amounts: { year: number; month: number; cents: number }[];
  adjustments: { year: number; month: number; effect: string }[];
  occurrences?: OcorrenciaGravada[];
  session: { id: string; name: string; groupId: string; group: { name: string } };
  statementLines?: { line: number }[];
};

type OcorrenciaGravada = {
  number: number;
  dueOn: Date;
  plannedCents: number;
  paidCents: number | null;
  paidOn: Date | null;
  status: string;
};

function baseDaLinha(atual: Linha) {
  return {
    category: atual.category as CategoriaTransacao,
    mode: atual.mode as ModoTransacao,
    transactionType: atual.transactionType as TipoTransacao,
    installments: atual.installments,
    dueDate: atual.dueOn ? dataIso(atual.dueOn) : null,
    interestRate: atual.interestBps == null ? null : percentualDeJuros(atual.interestBps),
    recurrence: atual.recurrence as Recorrencia | null,
    recurrenceInterval: atual.recurrenceInterval,
  };
}

function atributos(pedido: NovoLancamento) {
  return {
    name: pedido.name,
    occurredOn: dataPrisma(pedido.date),
    mode: pedido.mode,
    status: pedido.status,
    transactionType: pedido.transactionType,
    category: pedido.category,
    priority: pedido.priority,
    installmentNumber: pedido.installmentNumber,
    dueOn: pedido.dueDate ? dataPrisma(pedido.dueDate) : null,
    interestBps: pedido.interestRate == null ? null : jurosEmPontos(pedido.interestRate),
    nextDueOn: pedido.nextDueDate ? dataPrisma(pedido.nextDueDate) : null,
    recurrence: pedido.recurrence,
    recurrenceInterval: pedido.recurrenceInterval,
  };
}

function gravacao(pedido: NovoLancamento) {
  return {
    ...atributos(pedido),
    suspendedCents: 0,
    commitmentId: null,
  };
}

function igual(atual: Linha, pedido: NovoLancamento) {
  const meses = mesesDoPedido(pedido);
  const juros = pedido.interestRate == null ? null : jurosEmPontos(pedido.interestRate);
  const campos =
    atual.sessionId === pedido.sessionId &&
    atual.type === pedido.type &&
    atual.description === pedido.description &&
    atual.justification === pedido.justification &&
    atual.day === pedido.day &&
    atual.cents === pedido.cents &&
    atual.startYear === pedido.startYear &&
    atual.startMonth === pedido.startMonth &&
    atual.installments === pedido.installments &&
    atual.name === pedido.name &&
    dataIso(atual.occurredOn) === pedido.date &&
    atual.mode === pedido.mode &&
    atual.status === pedido.status &&
    atual.transactionType === pedido.transactionType &&
    atual.category === pedido.category &&
    atual.priority === pedido.priority &&
    atual.installmentNumber === pedido.installmentNumber &&
    (atual.dueOn ? dataIso(atual.dueOn) : null) === pedido.dueDate &&
    atual.interestBps === juros &&
    (atual.nextDueOn ? dataIso(atual.nextDueOn) : null) === pedido.nextDueDate &&
    atual.recurrence === pedido.recurrence &&
    atual.recurrenceInterval === pedido.recurrenceInterval &&
    atual.amounts.length === meses.length;
  if (!campos) return false;
  return meses.every((mes) =>
    atual.amounts.some(
      (item) => item.year === mes.year && item.month === mes.month && item.cents === mes.cents,
    ),
  );
}

function dataPrisma(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dataIso(data: Date) {
  return data.toISOString().slice(0, 10);
}

function lancamentoDe(row: Linha): Lancamento {
  return {
    id: row.id,
    groupId: row.session.groupId,
    groupName: row.session.group.name,
    sessionId: row.session.id,
    sessionName: row.session.name,
    type: row.type as TipoLancamento,
    description: row.description,
    justification: row.justification,
    day: row.day,
    cents: row.cents,
    startYear: row.startYear,
    startMonth: row.startMonth,
    installments: row.installments,
    months: row.amounts.map((mes) => ({ year: mes.year, month: mes.month, cents: mes.cents })),
    name: row.name,
    date: dataIso(row.occurredOn),
    mode: row.mode as ModoTransacao,
    status: row.status as StatusTransacao,
    transactionType: row.transactionType as TipoTransacao,
    category: row.category as CategoriaTransacao,
    priority: row.priority as PrioridadeTransacao,
    installmentNumber: row.installmentNumber,
    dueDate: row.dueOn ? dataIso(row.dueOn) : null,
    interestRate: row.interestBps == null ? null : percentualDeJuros(row.interestBps),
    nextDueDate: row.nextDueOn ? dataIso(row.nextDueOn) : null,
    suspendedCents: row.suspendedCents,
    commitmentId: row.commitmentId,
    recurrence: row.recurrence as Recorrencia | null,
    recurrenceInterval: row.recurrenceInterval,
    synced: (row.statementLines?.length ?? 0) > 0,
    adjustments: row.adjustments.map((ajuste) => ({
      year: ajuste.year,
      month: ajuste.month,
      effect: ajuste.effect as EfeitoTransacao,
    })),
    occurrences: (row.occurrences ?? []).length
      ? (row.occurrences ?? []).map(ocorrenciaDe)
      : gradeDoLancamento(contratoDaLinha(row)),
  };
}

function contratoDaLinha(row: Linha) {
  return {
    type: row.type as TipoLancamento,
    day: row.day,
    cents: row.cents,
    startYear: row.startYear,
    startMonth: row.startMonth,
    installments: row.installments,
    status: row.status as StatusTransacao,
    months: row.amounts.map((mes) => ({ year: mes.year, month: mes.month, cents: mes.cents })),
    recurrence: row.recurrence as Recorrencia | null,
    recurrenceInterval: row.recurrenceInterval,
    adjustments: row.adjustments.map((ajuste) => ({
      year: ajuste.year,
      month: ajuste.month,
      effect: ajuste.effect as EfeitoTransacao,
    })),
  };
}

function efetivasDaLinha(atual: Linha) {
  const gravadas = (atual.occurrences ?? []).map(ocorrenciaDe);
  if (gravadas.length > 0) return gravadas;
  return gradeDoLancamento(contratoDaLinha(atual));
}

function termosDaLinha(atual: Linha) {
  return {
    installments: atual.installments,
    dueDate: atual.dueOn ? dataIso(atual.dueOn) : null,
    interestRate: atual.interestBps == null ? null : percentualDeJuros(atual.interestBps),
    recurrence: atual.recurrence as Recorrencia | null,
    recurrenceInterval: atual.recurrenceInterval,
    cents: atual.cents,
    date: dataIso(atual.occurredOn),
  };
}

function termosDoPedido(pedido: NovoLancamento) {
  return {
    installments: pedido.installments,
    dueDate: pedido.dueDate,
    interestRate: pedido.interestRate,
    recurrence: pedido.recurrence,
    recurrenceInterval: pedido.recurrenceInterval,
    cents: pedido.cents,
    date: pedido.date,
  };
}

function gradeDoPedido(pedido: NovoLancamento) {
  return gradeDoLancamento({
    type: pedido.type,
    day: pedido.day,
    cents: pedido.cents,
    startYear: pedido.startYear,
    startMonth: pedido.startMonth,
    installments: pedido.installments,
    status: pedido.status,
    months: mesesDoPedido(pedido),
    recurrence: pedido.recurrence,
    recurrenceInterval: pedido.recurrenceInterval,
    adjustments: [],
  });
}

function resumoGravado(pedido: NovoLancamento, lista: Ocorrencia[]) {
  const parcelado = pedido.category === "installment" || pedido.category === "loan";
  const proximo = proximoVencimento(lista);
  return {
    status: statusAgregado(lista),
    installmentNumber: parcelado ? parcelaAtual(lista) : null,
    nextDueOn:
      pedido.category === "fixed" ? (proximo ? dataPrisma(proximo) : null) : pedido.nextDueDate ? dataPrisma(pedido.nextDueDate) : null,
  };
}

function dadosAninhados(item: Ocorrencia) {
  return {
    number: item.number,
    dueOn: dataPrisma(item.dueDate),
    plannedCents: item.plannedCents,
    paidCents: item.paidCents,
    paidOn: item.paidOn ? dataPrisma(item.paidOn) : null,
    status: item.status,
  };
}

function dadosOcorrencia(tenantId: string, entryId: string, item: Ocorrencia) {
  return { tenantId, entryId, ...dadosAninhados(item) };
}

function ocorrenciaDe(row: OcorrenciaGravada): Ocorrencia {
  return {
    number: row.number,
    dueDate: dataIso(row.dueOn),
    plannedCents: row.plannedCents,
    paidCents: row.paidCents,
    paidOn: row.paidOn ? dataIso(row.paidOn) : null,
    status: row.status as StatusTransacao,
  };
}

async function recusaDaSessao(
  tx: Prisma.TransactionClient,
  tenantId: string,
  sessionId: string,
  category: CategoriaTransacao,
  valor?: {
    id: string;
    cents: number;
    mode: string;
    pedidoCents: number;
    pedidoMode: string;
  },
) {
  const sessao = await tx.session.findFirst({
    where: { id: sessionId, tenantId },
    include: { group: true },
  });
  if (!sessao || sessao.group.tenantId !== tenantId) return "sessao-ausente" as const;
  if (sessao.endedAt) return "sessao-encerrada" as const;
  const kind: TipoSessao = sessao.kind === "valor" ? "valor" : "acumulo";
  if (!categoriaPermitida(kind, category)) {
    return kind === "valor" ? ("tipo-valor" as const) : ("tipo-acumulo" as const);
  }
  if (kind !== "valor") return null;
  const irmas = await tx.entry.findMany({
    where: { tenantId, sessionId, status: { not: "cancelled" } },
    select: { id: true, position: true, status: true },
  });
  const jaEsta = valor != null && irmas.some((item) => item.id === valor.id);
  if (!jaEsta && irmas.length > 0) return "valor-lancada" as const;
  if (
    valor &&
    protegeValorBase(
      kind,
      valor.id,
      irmas,
      valor.cents !== valor.pedidoCents || valor.mode !== valor.pedidoMode,
    )
  ) {
    return "valor-base" as const;
  }
  return null;
}

function igualLista(atual: Ocorrencia[], proxima: Ocorrencia[]) {
  return (
    atual.length === proxima.length &&
    atual.every((item, index) => {
      const outro = proxima[index];
      return (
        outro != null &&
        item.number === outro.number &&
        item.status === outro.status &&
        item.plannedCents === outro.plannedCents &&
        item.dueDate === outro.dueDate &&
        item.paidCents === outro.paidCents
      );
    })
  );
}

