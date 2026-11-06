import { Injectable } from "@nestjs/common";
import type { PedidoDeTarefa, Tarefa } from "@finnagent/contracts";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { TarefasRepositorio } from "../portas/tarefas-repositorio.js";

const selecao = { id: true, title: true, date: true, doneOn: true, position: true } as const;

@Injectable()
export class PrismaTarefasRepositorio implements TarefasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listarDoDia(tenantId: string, date: string) {
    const dia = dataPrisma(date);
    const rows = await this.banco().task.findMany({
      where: { tenantId, OR: [{ doneOn: null, date: { lte: dia } }, { doneOn: dia }] },
      orderBy: [{ date: "asc" }, { position: "asc" }],
      select: selecao,
    });
    return rows.map(tarefaDe);
  }

  async criar(tenantId: string, id: string, pedido: PedidoDeTarefa) {
    return this.banco().$transaction(async (tx) => {
      if (await tx.task.findFirst({ where: { id, tenantId }, select: { id: true } })) return "identificador" as const;
      const ultima = await tx.task.aggregate({ where: { tenantId }, _max: { position: true } });
      const criada = await tx.task.create({
        data: { id, tenantId, title: pedido.title, date: dataPrisma(pedido.date), position: (ultima._max.position ?? -1) + 1 },
        select: selecao,
      });
      await gravarOutbox(tx, tenantId, "criar-tarefa", id, { id, ...pedido }, marcaDe(pedido));
      return tarefaDe(criada);
    });
  }

  async atualizar(tenantId: string, id: string, pedido: PedidoDeTarefa) {
    return this.banco().$transaction(async (tx) => {
      const mudadas = await tx.task.updateMany({ where: { id, tenantId }, data: { title: pedido.title, date: dataPrisma(pedido.date) } });
      if (mudadas.count !== 1) return "ausente" as const;
      const salva = await tx.task.findFirstOrThrow({ where: { id, tenantId }, select: selecao });
      await gravarOutbox(tx, tenantId, "atualizar-tarefa", id, { id, ...pedido }, marcaDe(pedido));
      return tarefaDe(salva);
    });
  }

  async concluir(tenantId: string, id: string, doneOn: string | null) {
    return this.banco().$transaction(async (tx) => {
      const mudadas = await tx.task.updateMany({ where: { id, tenantId }, data: { doneOn: doneOn ? dataPrisma(doneOn) : null } });
      if (mudadas.count !== 1) return "ausente" as const;
      const salva = await tx.task.findFirstOrThrow({ where: { id, tenantId }, select: selecao });
      const payload = { id, doneOn };
      await gravarOutbox(tx, tenantId, "concluir-tarefa", id, payload, marcaDe(payload));
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

function tarefaDe(row: { id: string; title: string; date: Date; doneOn: Date | null; position: number }): Tarefa {
  return { id: row.id, title: row.title, date: dataIso(row.date), doneOn: row.doneOn ? dataIso(row.doneOn) : null, position: row.position };
}
