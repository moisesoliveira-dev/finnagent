import { Injectable } from "@nestjs/common";
import { TIPOS_DE_CONTA, type Conta, type PedidoDeConta } from "@finnagent/contracts";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { ContasRepositorio } from "../portas/contas-repositorio.js";

const selecao = { id: true, name: true, kind: true, openingCents: true } as const;

@Injectable()
export class PrismaContasRepositorio implements ContasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const rows = await this.banco().account.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: selecao });
    return rows.map(contaDe);
  }

  async criar(tenantId: string, id: string, pedido: PedidoDeConta) {
    return this.banco().$transaction(async (tx) => {
      if (await tx.account.findFirst({ where: { id, tenantId }, select: { id: true } })) return "identificador" as const;
      if (await nomeOcupado(tx, tenantId, pedido.name)) return "nome-ocupado" as const;
      const criada = await tx.account.create({ data: { id, tenantId, ...pedido }, select: selecao });
      await gravarOutbox(tx, tenantId, "criar-conta", id, { id, ...pedido }, marcaDe(pedido));
      return contaDe(criada);
    });
  }

  async atualizar(tenantId: string, id: string, pedido: PedidoDeConta) {
    return this.banco().$transaction(async (tx) => {
      const atual = await tx.account.findFirst({ where: { id, tenantId }, select: { id: true, _count: { select: { boxes: true } } } });
      if (!atual) return "ausente" as const;
      if (await nomeOcupado(tx, tenantId, pedido.name, id)) return "nome-ocupado" as const;
      if (pedido.kind === "cartao" && atual._count.boxes > 0) return "com-caixinhas" as const;
      await tx.account.updateMany({ where: { id, tenantId }, data: pedido });
      const salva = await tx.account.findFirstOrThrow({ where: { id, tenantId }, select: selecao });
      await gravarOutbox(tx, tenantId, "atualizar-conta", id, { id, ...pedido }, marcaDe(pedido));
      return contaDe(salva);
    });
  }

  async excluir(tenantId: string, id: string) {
    return this.banco().$transaction(async (tx) => {
      const atual = await tx.account.findFirst({ where: { id, tenantId }, select: { id: true, _count: { select: { statements: true, boxes: true } } } });
      if (!atual) return "ausente" as const;
      if (atual._count.statements > 0) return "com-extratos" as const;
      if (atual._count.boxes > 0) return "com-caixinhas" as const;
      // Os lançamentos perdem a conta (SetNull na relação) e continuam na sobra.
      await tx.account.deleteMany({ where: { id, tenantId } });
      await gravarOutbox(tx, tenantId, "remover-conta", id, { id });
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

type Transacao = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

async function nomeOcupado(tx: Transacao, tenantId: string, name: string, ignorarId?: string) {
  const outra = await tx.account.findFirst({
    where: { tenantId, name: { equals: name, mode: "insensitive" }, ...(ignorarId ? { NOT: { id: ignorarId } } : {}) },
    select: { id: true },
  });
  return Boolean(outra);
}

function contaDe(row: { id: string; name: string; kind: string; openingCents: number }): Conta {
  return {
    id: row.id,
    name: row.name,
    kind: TIPOS_DE_CONTA.find((item) => item === row.kind) ?? "conta",
    openingCents: row.openingCents,
  };
}
