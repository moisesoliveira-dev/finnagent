import { Injectable } from "@nestjs/common";
import { AGENTES_IA, type ConversaResumo, type MensagemDoChat, type ParteDaMensagem } from "@finnagent/contracts";
import { Prisma, type AiConversation, type AiMessage } from "@prisma/client";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { ConversaGravada, ConversasRepositorio, Pendencia } from "../portas/conversas-repositorio.js";

/** Os eventos levam só ids e contagens: o texto da conversa não sai daqui. */
@Injectable()
export class PrismaConversasRepositorio implements ConversasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string, userId: string) {
    const linhas = await this.banco().aiConversation.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return linhas.map(resumoDe);
  }

  async obter(tenantId: string, userId: string, id: string): Promise<ConversaGravada | null> {
    const linha = await this.banco().aiConversation.findFirst({
      where: { id, tenantId, userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!linha) return null;
    return {
      resumo: resumoDe(linha),
      pendencia: (linha.pending as Pendencia | null) ?? null,
      mensagens: linha.messages.map(mensagemDe),
    };
  }

  async criar(tenantId: string, userId: string, id: string, title: string) {
    return this.banco().$transaction(async (tx) => {
      const criada = await tx.aiConversation.create({ data: { id, tenantId, userId, title } });
      await gravarOutbox(tx, tenantId, "criar-conversa", id, { id, userId });
      return resumoDe(criada);
    });
  }

  async gravarMensagem(tenantId: string, conversationId: string, mensagem: MensagemDoChat) {
    await this.banco().$transaction(async (tx) => {
      const dados = {
        role: mensagem.role,
        parts: mensagem.partes as unknown as Prisma.InputJsonValue,
        agent: mensagem.agente,
      };
      await tx.aiMessage.upsert({
        where: { id: mensagem.id },
        create: { id: mensagem.id, tenantId, conversationId, createdAt: new Date(mensagem.createdAt), ...dados },
        update: dados,
      });
      await tx.aiConversation.updateMany({ where: { id: conversationId, tenantId }, data: { updatedAt: new Date() } });
      const acoes = mensagem.partes.filter((parte) => parte.tipo === "acao").length;
      await gravarOutbox(tx, tenantId, "registrar-mensagem-do-assistente", mensagem.id, {
        id: mensagem.id,
        conversationId,
        role: mensagem.role,
        acoes,
      }, `${mensagem.partes.length}`);
    });
  }

  async definirPendencia(tenantId: string, conversationId: string, pendencia: Pendencia | null) {
    await this.banco().aiConversation.updateMany({
      where: { id: conversationId, tenantId },
      // NULL numa coluna JSON pede o valor especial do Prisma.
      data: { pending: pendencia === null ? Prisma.DbNull : (pendencia as unknown as Prisma.InputJsonValue) },
    });
  }

  async renomear(tenantId: string, userId: string, id: string, title: string) {
    return this.banco().$transaction(async (tx) => {
      const atualizadas = await tx.aiConversation.updateMany({ where: { id, tenantId, userId }, data: { title } });
      if (atualizadas.count === 0) return null;
      await gravarOutbox(tx, tenantId, "renomear-conversa", id, { id }, title.length.toString());
      const linha = await tx.aiConversation.findFirstOrThrow({ where: { id, tenantId, userId } });
      return resumoDe(linha);
    });
  }

  async remover(tenantId: string, userId: string, id: string) {
    return this.banco().$transaction(async (tx) => {
      const apagadas = await tx.aiConversation.deleteMany({ where: { id, tenantId, userId } });
      if (apagadas.count === 0) return false;
      await gravarOutbox(tx, tenantId, "remover-conversa", id, { id });
      return true;
    });
  }

  async removerTodas(tenantId: string, userId: string) {
    return this.banco().$transaction(async (tx) => {
      const apagadas = await tx.aiConversation.deleteMany({ where: { tenantId, userId } });
      if (apagadas.count > 0) {
        await gravarOutbox(tx, tenantId, "remover-conversas", userId, { userId, total: apagadas.count }, new Date().toISOString());
      }
      return apagadas.count;
    });
  }

  async limparAntigas(tenantId: string, antesDe: Date) {
    return this.banco().$transaction(async (tx) => {
      const apagadas = await tx.aiConversation.deleteMany({ where: { tenantId, updatedAt: { lt: antesDe } } });
      if (apagadas.count > 0) {
        await gravarOutbox(tx, tenantId, "expirar-conversas", tenantId, { total: apagadas.count }, antesDe.toISOString().slice(0, 10));
      }
      return apagadas.count;
    });
  }

  async planosEsperando(tenantId: string, antesDe: Date) {
    const linhas = await this.banco().aiConversation.findMany({
      where: { tenantId, updatedAt: { lt: antesDe }, NOT: { pending: { equals: Prisma.DbNull } } },
      select: { id: true, userId: true, title: true, pending: true },
    });
    return linhas.flatMap((linha) => {
      const pendencia = linha.pending as Pendencia | null;
      if (pendencia?.aguardando.tipo !== "plano") return [];
      return [{ conversaId: linha.id, userId: linha.userId, titulo: linha.title, mensagemId: pendencia.mensagemId }];
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function resumoDe(linha: AiConversation): ConversaResumo {
  return { id: linha.id, title: linha.title, updatedAt: linha.updatedAt.toISOString(), pendente: linha.pending !== null };
}

function mensagemDe(linha: AiMessage): MensagemDoChat {
  return {
    id: linha.id,
    role: linha.role === "user" ? "user" : "assistant",
    partes: Array.isArray(linha.parts) ? (linha.parts as unknown as ParteDaMensagem[]) : [],
    agente: AGENTES_IA.find((item) => item === linha.agent) ?? null,
    createdAt: linha.createdAt.toISOString(),
  };
}
