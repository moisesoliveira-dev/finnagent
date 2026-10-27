import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type {
  AuthRepositorio,
  MotivoDoFim,
  NovaSessao,
  NovoUsuario,
  SessaoGravada,
  Usuario,
  UsuarioComSenha,
} from "../portas/auth-repositorio.js";

@Injectable()
export class PrismaAuthRepositorio implements AuthRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async criarUsuario(novo: NovoUsuario) {
    const db = this.banco();
    const candidatos = novo.tenantPreferido ? [novo.tenantPreferido, randomUUID()] : [randomUUID()];
    for (const tenantId of candidatos) {
      try {
        return await db.$transaction(async (tx) => {
          const criado = await tx.user.create({
            data: { id: novo.id, tenantId, email: novo.email, name: novo.name, passwordHash: novo.passwordHash },
          });
          await gravarOutbox(tx, tenantId, "criar-usuario", novo.id, { id: novo.id, tenantId });
          return usuarioDe(criado);
        });
      } catch (error) {
        if (!violouUnico(error)) throw error;
        if (await db.user.findUnique({ where: { email: novo.email }, select: { id: true } })) {
          return "email-em-uso" as const;
        }
        // O e-mail estava livre, então foi o tenant que já tinha dono: tenta o próximo.
      }
    }
    throw new Error("Não foi possível reservar um tenant para o usuário.");
  }

  async buscarPorEmail(email: string): Promise<UsuarioComSenha | null> {
    const linha = await this.banco().user.findUnique({ where: { email } });
    return linha ? { ...usuarioDe(linha), passwordHash: linha.passwordHash, lockedUntil: linha.lockedUntil } : null;
  }

  async buscarUsuario(id: string) {
    const linha = await this.banco().user.findUnique({ where: { id } });
    return linha ? usuarioDe(linha) : null;
  }

  async registrarFalha(id: string, limite: number, bloqueioMs: number, agora: Date) {
    await this.banco().$transaction(async (tx) => {
      const atual = await tx.user.update({
        where: { id },
        data: { failedAttempts: { increment: 1 } },
        select: { tenantId: true, failedAttempts: true },
      });
      await gravarOutbox(tx, atual.tenantId, "registrar-falha-de-acesso", id, { userId: id }, randomUUID());
      if (atual.failedAttempts < limite) return;
      const ate = new Date(agora.getTime() + bloqueioMs);
      await tx.user.update({ where: { id }, data: { failedAttempts: 0, lockedUntil: ate } });
      await gravarOutbox(tx, atual.tenantId, "bloquear-conta", id, { userId: id, ate: ate.toISOString() }, randomUUID());
    });
  }

  async zerarFalhas(id: string) {
    await this.banco().$transaction(async (tx) => {
      const atual = await tx.user.findUnique({
        where: { id },
        select: { tenantId: true, failedAttempts: true, lockedUntil: true },
      });
      if (!atual || (atual.failedAttempts === 0 && !atual.lockedUntil)) return;
      await tx.user.update({ where: { id }, data: { failedAttempts: 0, lockedUntil: null } });
      await gravarOutbox(tx, atual.tenantId, "zerar-falhas-de-acesso", id, { userId: id }, randomUUID());
    });
  }

  async criarSessao(sessao: NovaSessao, agora: Date) {
    await this.banco().$transaction(async (tx) => {
      const vencidas = await tx.authSession.deleteMany({ where: { userId: sessao.userId, expiresAt: { lt: agora } } });
      await tx.authSession.create({ data: sessao });
      // O id da sessão é o hash do token, então fica fora do evento.
      const payload = {
        userId: sessao.userId,
        expiresAt: sessao.expiresAt.toISOString(),
        vencidasRemovidas: vencidas.count,
      };
      await gravarOutbox(tx, sessao.tenantId, "abrir-sessao", sessao.userId, payload, randomUUID());
    });
  }

  async buscarSessao(id: string): Promise<SessaoGravada | null> {
    const linha = await this.banco().authSession.findUnique({ where: { id } });
    return linha ? { tenantId: linha.tenantId, userId: linha.userId, expiresAt: linha.expiresAt } : null;
  }

  async removerSessao(id: string, motivo: MotivoDoFim) {
    await this.banco().$transaction(async (tx) => {
      const linha = await tx.authSession.findUnique({ where: { id }, select: { tenantId: true, userId: true } });
      if (!linha) return;
      // Duas chamadas ao mesmo tempo podem chegar aqui: só quem de fato apagou registra o evento.
      const apagadas = await tx.authSession.deleteMany({ where: { id } });
      if (apagadas.count === 0) return;
      await gravarOutbox(tx, linha.tenantId, "encerrar-sessao", linha.userId, { userId: linha.userId, motivo }, randomUUID());
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function usuarioDe(linha: User): Usuario {
  return { id: linha.id, tenantId: linha.tenantId, email: linha.email, name: linha.name };
}

function violouUnico(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}
