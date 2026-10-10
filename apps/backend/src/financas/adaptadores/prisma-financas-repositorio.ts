import { Injectable } from "@nestjs/common";
import {
  categoriaDeCompromisso,
  type CategoriaTransacao,
  type EfeitoTransacao,
  type Lancamento,
  type ModoTransacao,
  type PrioridadeTransacao,
  type StatusTransacao,
  type Recorrencia,
  type TipoLancamento,
  type TipoTransacao,
} from "@finnagent/contracts";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { EXEMPLO, WORKFLOW_INICIAL } from "../dominio/exemplo.js";
import type { Prisma } from "@prisma/client";
import { adiantarParcela, jurosEmPontos, percentualDeJuros } from "../dominio/transacao.js";
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
        adjustments: { where: { tenantId } },
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
          adjustments: { where: { tenantId } },
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
      if (sessao.endedAt) return "sessao-encerrada" as const;
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
        },
        include: {
          amounts: { where: { tenantId } },
          adjustments: { where: { tenantId } },
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
      if (atual.sessionId !== pedido.sessionId) {
        const sessao = await tx.session.findFirst({
          where: { id: pedido.sessionId, tenantId },
          include: { group: true },
        });
        if (!sessao || sessao.group.tenantId !== tenantId) return "sessao-ausente" as const;
        if (sessao.endedAt) return "sessao-encerrada" as const;
      }
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
          ...(pedido.category === "fixed" ? {} : { suspendedCents: 0 }),
        },
      });
      await tx.entryAmount.deleteMany({ where: { entryId: pedido.id, tenantId } });
      if (meses.length > 0) {
        await tx.entryAmount.createMany({
          data: meses.map((mes) => ({ ...mes, entryId: pedido.id, tenantId })),
        });
      }
      if (pedido.category !== "fixed") {
        await tx.entryAdjustment.deleteMany({ where: { entryId: pedido.id, tenantId } });
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
      if (atual.status === status) return { status };
      await tx.entry.updateMany({ where: { id, tenantId }, data: { status } });
      return { status };
    });
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
      const passo = adiantarParcela(
        atual.installmentNumber ?? 1,
        atual.installments ?? 0,
        atual.status as StatusTransacao,
      );
      if (passo === "encerrada") return "encerrada" as const;
      if (passo === "concluida") return "concluida" as const;
      await tx.entry.updateMany({
        where: { id, tenantId },
        data: { installmentNumber: passo.installmentNumber, status: passo.status },
      });
      return passo;
    });
  }

  async cancelarSerie(tenantId: string, id: string, category: "installment" | "loan") {
    const operacao = category === "installment" ? "cancelar-parcelas" : "cancelar-emprestimo";
    return this.alterar(tenantId, id, operacao, async (tx, atual) => {
      if (atual.category !== category) return "categoria" as const;
      if (atual.status === "cancelled") return {};
      await tx.entry.updateMany({ where: { id, tenantId }, data: { status: "cancelled" } });
      return { status: "cancelled" };
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
        const mode = valor.cents > 0 ? "inflows" : "outflows";
        await tx.entry.updateMany({
          where: { id: valor.id, tenantId },
          data: { cents: valor.cents, mode },
        });
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
        session: { include: { group: true } },
      },
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

type FalhaCurta = "categoria" | "encerrada" | "concluida";

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
  session: { id: string; name: string; groupId: string; group: { name: string } };
};

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
    adjustments: row.adjustments.map((ajuste) => ({
      year: ajuste.year,
      month: ajuste.month,
      effect: ajuste.effect as EfeitoTransacao,
    })),
  };
}

