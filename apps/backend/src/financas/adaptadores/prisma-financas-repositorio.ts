import { Injectable } from "@nestjs/common";
import type { Lancamento, TipoLancamento } from "@finnagent/contracts";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { EXEMPLO, WORKFLOW_INICIAL } from "../dominio/exemplo.js";
import type { FinancasRepositorio, NovoLancamento } from "../portas/financas-repositorio.js";

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
            amounts: { create: item.months },
          },
        });
        await gravarOutbox(tx, tenantId, "criar-lancamento", item.id, item, marcaDe(item));
      }
    });
  }

  async listar(tenantId: string) {
    const db = this.banco();
    const workflow = await db.workflow.findUnique({ where: { tenantId } });
    const rows = await db.entry.findMany({
      where: { tenantId },
      orderBy: { position: "asc" },
      include: {
        amounts: {
          where: { tenantId },
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
        session: { include: { group: true } },
      },
    });
    return {
      workflow: workflow
        ? { year: workflow.year, month: workflow.month, day: workflow.day }
        : WORKFLOW_INICIAL,
      entries: rows.map(lancamentoDe),
    };
  }

  async criar(tenantId: string, pedido: NovoLancamento) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.entry.findFirst({
        where: { id: pedido.id, tenantId },
        include: {
          amounts: { where: { tenantId } },
          session: { include: { group: true } },
        },
      });
      if (atual) {
        if (mesmoLancamento(atual, pedido)) return lancamentoDe(atual);
        return "identificador" as const;
      }
      const sessao = await tx.session.findFirst({
        where: { id: pedido.sessionId, tenantId },
        include: { group: true },
      });
      if (!sessao || sessao.group.tenantId !== tenantId) return "sessao-ausente" as const;
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
          amounts: { create: meses },
        },
        include: {
          amounts: { where: { tenantId } },
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

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
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

function lancamentoDe(row: {
  id: string;
  type: string;
  description: string;
  justification: string;
  day: number;
  cents: number;
  startYear: number;
  startMonth: number;
  installments: number | null;
  amounts: { year: number; month: number; cents: number }[];
  session: { id: string; name: string; groupId: string; group: { name: string } };
}): Lancamento {
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
  };
}

