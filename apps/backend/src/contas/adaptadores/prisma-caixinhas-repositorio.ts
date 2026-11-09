import { Injectable } from "@nestjs/common";
import type { Caixinha, PedidoDeCaixinha } from "@finnagent/contracts";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { CaixinhasRepositorio } from "../portas/caixinhas-repositorio.js";

const selecao = { id: true, accountId: true, name: true, openingCents: true, openingOn: true, sessionId: true, goalId: true } as const;
type Row = { id: string; accountId: string; name: string; openingCents: number; openingOn: Date | null; sessionId: string; goalId: string | null };
const caixinhaDe = (row: Row): Caixinha => ({ ...row, openingOn: row.openingOn ? row.openingOn.toISOString().slice(0, 10) : null });
const dataDe = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);
type Transacao = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

@Injectable()
export class PrismaCaixinhasRepositorio implements CaixinhasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const rows = await this.banco().accountBox.findMany({ where: { tenantId }, orderBy: [{ accountId: "asc" }, { name: "asc" }], select: selecao });
    return rows.map(caixinhaDe);
  }

  async obter(tenantId: string, id: string) {
    const row = await this.banco().accountBox.findFirst({ where: { id, tenantId }, select: selecao });
    return row ? caixinhaDe(row) : null;
  }

  async criar(tenantId: string, caixinha: Caixinha) {
    return this.banco().$transaction(async (tx) => {
      const atual = await tx.accountBox.findFirst({ where: { id: caixinha.id, tenantId }, select: selecao });
      if (atual) return mesma(caixinhaDe(atual), caixinha) ? caixinhaDe(atual) : ("identificador" as const);
      const conta = await tx.account.findFirst({ where: { id: caixinha.accountId, tenantId }, select: { kind: true } });
      if (!conta) return "conta-ausente" as const;
      if (conta.kind === "cartao") return "cartao" as const;
      const falha = await validar(tx, tenantId, caixinha.accountId, caixinha.name, caixinha.goalId);
      if (falha) return falha;
      const criada = await tx.accountBox.create({ data: { tenantId, ...caixinha, openingOn: dataDe(caixinha.openingOn) }, select: selecao });
      await gravarOutbox(tx, tenantId, "criar-caixinha", caixinha.id, caixinha, marcaDe(caixinha));
      return caixinhaDe(criada);
    });
  }

  async atualizar(tenantId: string, id: string, pedido: PedidoDeCaixinha) {
    return this.banco().$transaction(async (tx) => {
      const atual = await tx.accountBox.findFirst({ where: { id, tenantId }, select: selecao });
      if (!atual) return "ausente" as const;
      const falha = await validar(tx, tenantId, atual.accountId, pedido.name, pedido.goalId, id);
      if (falha) return falha;
      const { openingOn, ...resto } = pedido;
      await tx.accountBox.updateMany({ where: { id, tenantId }, data: { ...resto, ...(openingOn !== undefined ? { openingOn: dataDe(openingOn) } : {}) } });
      await gravarOutbox(tx, tenantId, "atualizar-caixinha", id, { id, ...pedido }, marcaDe(pedido));
      return caixinhaDe(await tx.accountBox.findFirstOrThrow({ where: { id, tenantId }, select: selecao }));
    });
  }

  async ligarMeta(tenantId: string, goalId: string, boxId: string | null) {
    return this.banco().$transaction(async (tx) => {
      if (!(await tx.goal.findFirst({ where: { id: goalId, tenantId }, select: { id: true } }))) return "meta-ausente" as const;
      if (boxId && !(await tx.accountBox.findFirst({ where: { id: boxId, tenantId }, select: { id: true } }))) return "ausente" as const;
      await tx.accountBox.updateMany({ where: { tenantId, goalId }, data: { goalId: null } });
      if (boxId) await tx.accountBox.updateMany({ where: { id: boxId, tenantId }, data: { goalId } });
      const payload = { goalId, boxId };
      await gravarOutbox(tx, tenantId, "ligar-meta-a-caixinha", goalId, payload, marcaDe(payload));
      return "ok" as const;
    });
  }

  async excluir(tenantId: string, id: string) {
    return this.banco().$transaction(async (tx) => {
      const atual = await tx.accountBox.findFirst({ where: { id, tenantId }, select: selecao });
      if (!atual) return "ausente" as const;
      await tx.accountBox.deleteMany({ where: { id, tenantId } });
      await gravarOutbox(tx, tenantId, "excluir-caixinha", id, { id });
      return caixinhaDe(atual);
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

async function validar(tx: Transacao, tenantId: string, accountId: string, name: string, goalId: string | null, ignorarId?: string) {
  const outra = await tx.accountBox.findFirst({
    where: { tenantId, accountId, name: { equals: name, mode: "insensitive" }, ...(ignorarId ? { NOT: { id: ignorarId } } : {}) },
    select: { id: true },
  });
  if (outra) return "nome-ocupado" as const;
  if (!goalId) return null;
  if (!(await tx.goal.findFirst({ where: { id: goalId, tenantId }, select: { id: true } }))) return "meta-ausente" as const;
  const ocupada = await tx.accountBox.findFirst({ where: { tenantId, goalId, ...(ignorarId ? { NOT: { id: ignorarId } } : {}) }, select: { id: true } });
  return ocupada ? ("meta-ocupada" as const) : null;
}

function mesma(atual: Caixinha, pedido: Caixinha) {
  return (
    atual.accountId === pedido.accountId &&
    atual.name === pedido.name &&
    atual.openingCents === pedido.openingCents &&
    atual.openingOn === pedido.openingOn &&
    atual.goalId === pedido.goalId
  );
}
