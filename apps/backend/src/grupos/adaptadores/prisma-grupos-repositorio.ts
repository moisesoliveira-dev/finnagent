import { Injectable } from "@nestjs/common";
import type { Grupo, Sessao, TipoSessao, ViradaGrupo, ViradaResposta } from "@finnagent/contracts";
import { Prisma } from "@prisma/client";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel, Conflito, NaoEncontrado, PedidoInvalido } from "../dominio/erros.js";
import { aceitaLancamento, categoriasDaSessao, hojeNoFuso, resumoDaSessao } from "../dominio/sessao.js";
import { montarVirada, sessoesEncerradas } from "../dominio/virada.js";
import type { DadosDaSessao, GruposRepositorio } from "../portas/grupos-repositorio.js";

const sessaoCompleta = {
  id: true,
  groupId: true,
  name: true,
  description: true,
  justification: true,
  startedAt: true,
  endedAt: true,
  cents: true,
  kind: true,
  entries: {
    select: {
      id: true,
      position: true,
      status: true,
      cents: true,
      amounts: { select: { cents: true } },
    },
  },
};

class DecisaoConcorrente extends Error {}

@Injectable()
export class PrismaGruposRepositorio implements GruposRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const db = this.banco();
    const groups = await db.group.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    });
    const sessions = await db.session.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: sessaoCompleta,
    });
    return { groups, sessions: sessions.map(sessaoDe) };
  }

  async criarGrupo(tenantId: string, id: string, name: string, description: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.group.findFirst({ where: { id, tenantId } });
      if (atual) {
        if (atual.name === name && atual.description === description) return grupoDe(atual);
        return "identificador" as const;
      }
      const ocupado = await nomeDeGrupoOcupado(tx, tenantId, name);
      if (ocupado) return "nome" as const;
      const criado = await tx.group.create({ data: { id, tenantId, name, description } });
      await gravarOutbox(tx, tenantId, "criar-grupo", id, { id, name, description });
      return grupoDe(criado);
    });
  }

  async atualizarGrupo(tenantId: string, id: string, name: string, description: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.group.findFirst({ where: { id, tenantId } });
      if (!atual) return "ausente" as const;
      const ocupado = await nomeDeGrupoOcupado(tx, tenantId, name, id);
      if (ocupado) return "nome" as const;
      const gravados = await tx.group.updateMany({
        where: { id, tenantId },
        data: { name, description },
      });
      if (gravados.count !== 1) return "ausente" as const;
      const salvo = await tx.group.findFirst({ where: { id, tenantId } });
      if (!salvo) return "ausente" as const;
      const payload = { id, name, description };
      await gravarOutbox(tx, tenantId, "atualizar-grupo", id, payload, marcaDe(payload));
      return grupoDe(salvo);
    });
  }

  async removerGrupo(tenantId: string, id: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const grupo = await tx.group.findFirst({ where: { id, tenantId } });
      if (!grupo) return false;
      const sessoes = await tx.session.findMany({
        where: { tenantId, groupId: id },
      });
      const sessionIds = sessoes.map((sessao) => sessao.id);
      const lancamentos = sessionIds.length
        ? await tx.entry.findMany({
            where: { tenantId, sessionId: { in: sessionIds } },
            select: { id: true, _count: { select: { statementLines: true } } },
          })
        : [];
      if (lancamentos.some((item) => item._count.statementLines > 0)) {
        throw new Conflito("Esse grupo tem um lançamento sincronizado com o extrato.");
      }
      const entryIds = lancamentos.map((item) => item.id);
      if (entryIds.length) {
        await tx.appointment.updateMany({
          where: { tenantId, entryId: { in: entryIds } },
          data: { entryId: null },
        });
        await tx.entry.deleteMany({ where: { tenantId, id: { in: entryIds } } });
        for (const entryId of entryIds) {
          await gravarOutbox(tx, tenantId, "excluir-lancamento", entryId, { id: entryId });
        }
      }
      for (const sessao of sessoes) {
        await gravarOutbox(tx, tenantId, "remover-sessao", sessao.id, {
          id: sessao.id,
          groupId: id,
        });
        await apagarSessao(tx, sessao.id, tenantId, id);
      }
      await gravarOutbox(tx, tenantId, "remover-grupo", id, { id });
      const apagados = await tx.group.deleteMany({ where: { id, tenantId } });
      if (apagados.count !== 1) throw new NaoEncontrado("Grupo não encontrado.");
      return true;
    });
  }

  async criarSessao(
    tenantId: string,
    id: string,
    dados: DadosDaSessao,
    kind: TipoSessao,
    cents: number,
    startedAt: string,
  ) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.session.findFirst({ where: { id, tenantId }, select: sessaoCompleta });
      if (atual) {
        if (sessaoIgual(atual, dados, kind, cents)) return sessaoDe(atual);
        return "identificador" as const;
      }
      if (!(await grupoDoTenant(tx, tenantId, dados.groupId))) {
        return "grupo-ausente" as const;
      }
      if (await nomeDeSessaoOcupado(tx, tenantId, dados.groupId, dados.name)) {
        return "nome" as const;
      }
      await tx.session.create({
        data: {
          id,
          tenantId,
          kind,
          cents,
          startedAt: dataPrisma(startedAt),
          endedAt: null,
          ...gravacao(dados),
        },
      });
      await gravarOutbox(tx, tenantId, "criar-sessao", id, {
        id,
        kind,
        cents,
        startedAt,
        endedAt: null,
        ...dados,
      });
      const criada = await tx.session.findFirst({ where: { id, tenantId }, select: sessaoCompleta });
      if (!criada) return "identificador" as const;
      return sessaoDe(criada);
    });
  }

  async atualizarSessao(tenantId: string, id: string, dados: DadosDaSessao) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.session.findFirst({ where: { id, tenantId } });
      if (!atual) return "ausente" as const;
      if (!(await grupoDoTenant(tx, tenantId, dados.groupId))) {
        return "grupo-ausente" as const;
      }
      if (await nomeDeSessaoOcupado(tx, tenantId, dados.groupId, dados.name, id)) {
        return "nome" as const;
      }
      const gravadas = await tx.session.updateMany({
        where: { id, tenantId },
        data: gravacao(dados),
      });
      if (gravadas.count !== 1) return "ausente" as const;
      const salva = await tx.session.findFirst({ where: { id, tenantId }, select: sessaoCompleta });
      if (!salva) return "ausente" as const;
      const payload = { id, ...dados };
      await gravarOutbox(tx, tenantId, "atualizar-sessao", id, payload, marcaDe(payload));
      return sessaoDe(salva);
    });
  }

  async consultarVirada(tenantId: string): Promise<ViradaResposta> {
    const db = this.banco();
    const hoje = hojeNoFuso();
    const workflow = await db.workflow.findUnique({ where: { tenantId } });
    if (!workflow) return { pendente: false };
    const [decidida, abertas] = await Promise.all([
      db.yearStay.findUnique({ where: { tenantId_year: { tenantId, year: hoje.year } } }),
      db.session.findMany({
        where: { tenantId, endedAt: null },
        orderBy: [{ group: { name: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, group: { select: { id: true, name: true } } },
      }),
    ]);
    return montarVirada(hoje, workflow.year, Boolean(decidida), gruposAbertos(abertas));
  }

  async permanecer(tenantId: string, year: number, groupIds: string[], sessionIds: string[]) {
    const db = this.banco();
    const hoje = hojeNoFuso();
    try {
    await db.$transaction(async (tx) => {
      const workflow = await tx.workflow.findUnique({ where: { tenantId } });
      if (!workflow) return;
      const decidida = await tx.yearStay.findUnique({
        where: { tenantId_year: { tenantId, year: hoje.year } },
      });
      const abertas = await tx.session.findMany({
        where: { tenantId, endedAt: null },
        orderBy: [{ group: { name: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, groupId: true, group: { select: { id: true, name: true } } },
      });
      const groups = gruposAbertos(abertas);
      const virada = montarVirada(hoje, workflow.year, Boolean(decidida), groups);
      if (!virada.pendente) return;
      if (virada.year !== year) throw new PedidoInvalido("Esse ano não está em aberto.");
      const encerrar = sessoesEncerradas(groups, groupIds, sessionIds);
      const fim = `${year - 1}-12-31`;
      for (const id of encerrar) {
        const sessao = abertas.find((item) => item.id === id);
        const gravadas = await tx.session.updateMany({
          where: { id, tenantId, endedAt: null },
          data: { endedAt: dataPrisma(fim) },
        });
        if (gravadas.count !== 1) {
          const atual = await tx.session.findFirst({ where: { id, tenantId } });
          if (atual?.endedAt) throw new DecisaoConcorrente();
          throw new Error("Sessão ausente depois de encerrar.");
        }
        await gravarOutbox(tx, tenantId, "encerrar-sessao", id, {
          id,
          groupId: sessao?.groupId,
          endedAt: fim,
        });
      }
      await tx.yearStay.create({ data: { tenantId, year } });
      await gravarOutbox(
        tx,
        tenantId,
        "permanecer-ano",
        tenantId,
        { year, groupIds, sessionIds },
        String(year),
      );
    });
    } catch (error) {
      if (error instanceof DecisaoConcorrente) return;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
      throw error;
    }
  }

  async removerSessao(tenantId: string, id: string, endedAt: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const sessao = await tx.session.findFirst({ where: { id, tenantId } });
      if (!sessao) return false;
      if (sessao.endedAt) return true;
      const encerradas = await tx.session.updateMany({
        where: { id, tenantId, endedAt: null },
        data: { endedAt: dataPrisma(endedAt) },
      });
      if (encerradas.count !== 1) {
        const atual = await tx.session.findFirst({ where: { id, tenantId } });
        return Boolean(atual?.endedAt);
      }
      await gravarOutbox(tx, tenantId, "encerrar-sessao", id, {
        id,
        groupId: sessao.groupId,
        endedAt,
      });
      return true;
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function gruposAbertos(
  rows: Array<{ id: string; name: string; group: { id: string; name: string } }>,
): ViradaGrupo[] {
  const groups: ViradaGrupo[] = [];
  for (const row of rows) {
    let group = groups.find((item) => item.id === row.group.id);
    if (!group) {
      group = { id: row.group.id, name: row.group.name, sessions: [] };
      groups.push(group);
    }
    group.sessions.push({ id: row.id, name: row.name });
  }
  return groups;
}

function grupoDe(row: { id: string; name: string; description: string }): Grupo {
  return { id: row.id, name: row.name, description: row.description };
}

function sessaoDe(row: {
  id: string;
  groupId: string;
  name: string;
  description: string;
  justification: string;
  startedAt: Date | null;
  endedAt: Date | null;
  cents: number;
  kind: string;
  entries: { id: string; position: number; status: string; cents: number; amounts: { cents: number }[] }[];
}): Sessao {
  const kind: TipoSessao = row.kind === "valor" ? "valor" : "acumulo";
  const resumo = resumoDaSessao(
    kind,
    row.entries.map((item) => ({
      id: item.id,
      position: item.position,
      status: item.status,
      cents: item.cents,
      months: item.amounts.map((mes) => mes.cents),
    })),
  );
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    description: row.description,
    justification: row.justification,
    startedAt: dataIso(row.startedAt),
    endedAt: dataIso(row.endedAt),
    kind,
    categories: categoriasDaSessao(kind),
    available: aceitaLancamento(kind, row.entries),
    cents: resumo.cents,
    additions: resumo.additions,
    totalCents: resumo.totalCents,
  };
}

function gravacao(dados: DadosDaSessao) {
  return {
    groupId: dados.groupId,
    name: dados.name,
    description: dados.description,
    justification: dados.justification,
  };
}

function sessaoIgual(
  atual: {
    groupId: string;
    name: string;
    description: string;
    justification: string;
    kind: string;
    cents: number;
  },
  dados: DadosDaSessao,
  kind: TipoSessao,
  cents: number,
) {
  return (
    atual.groupId === dados.groupId &&
    atual.name === dados.name &&
    atual.description === dados.description &&
    atual.justification === dados.justification &&
    atual.kind === kind &&
    atual.cents === cents
  );
}

function dataIso(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function dataPrisma(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function apagarSessao(
  tx: Prisma.TransactionClient,
  id: string,
  tenantId: string,
  groupId?: string,
) {
  try {
    const apagadas = await tx.session.deleteMany({
      where: { id, tenantId, ...(groupId ? { groupId } : {}) },
    });
    if (apagadas.count !== 1) throw new NaoEncontrado("Sessão não encontrada.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2014")) {
      throw new Conflito("Essa sessão tem lançamentos.");
    }
    throw error;
  }
}

async function grupoDoTenant(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.group.findFirst({ where: { id, tenantId } });
}

async function nomeDeGrupoOcupado(
  tx: Prisma.TransactionClient,
  tenantId: string,
  name: string,
  ignorarId?: string,
) {
  return tx.group.findFirst({
    where: {
      tenantId,
      name: { equals: name, mode: "insensitive" },
      ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
    },
  });
}

async function nomeDeSessaoOcupado(
  tx: Prisma.TransactionClient,
  tenantId: string,
  groupId: string,
  name: string,
  ignorarId?: string,
) {
  return tx.session.findFirst({
    where: {
      tenantId,
      groupId,
      endedAt: null,
      name: { equals: name, mode: "insensitive" },
      ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
    },
  });
}
