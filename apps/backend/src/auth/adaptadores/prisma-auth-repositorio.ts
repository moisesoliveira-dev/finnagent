import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PAPEIS, TONS_DO_AVATAR, type DadosDoPerfil, type PapelDoUsuario } from "@finnagent/contracts";
import type { User } from "@prisma/client";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type {
  AuthRepositorio,
  MotivoDoFim,
  NovaSessao,
  NovoMembro,
  NovoUsuario,
  PerfilGravado,
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
            data: {
              id: novo.id,
              tenantId,
              email: novo.email,
              name: novo.name,
              passwordHash: novo.passwordHash,
              role: "master",
            },
          });
          await gravarOutbox(tx, tenantId, "criar-usuario", novo.id, { id: novo.id, tenantId, role: "master" });
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

  async criarMembro(tenantId: string, novo: NovoMembro) {
    try {
      return await this.banco().$transaction(async (tx) => {
        const criado = await tx.user.create({
          data: {
            id: novo.id,
            tenantId,
            email: novo.email,
            name: novo.name,
            passwordHash: novo.passwordHash,
            role: "membro",
          },
        });
        await gravarOutbox(tx, tenantId, "criar-usuario", novo.id, { id: novo.id, tenantId, role: "membro" });
        return usuarioDe(criado);
      });
    } catch (error) {
      if (violouUnico(error)) return "email-em-uso" as const;
      throw error;
    }
  }

  async listarTenants() {
    const linhas = await this.banco().user.findMany({ distinct: ["tenantId"], select: { tenantId: true } });
    return linhas.map((linha) => linha.tenantId);
  }

  async listarDoTenant(tenantId: string) {
    // "master" vem antes de "membro" na ordem alfabética: o master abre a lista.
    const linhas = await this.banco().user.findMany({
      where: { tenantId },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    return linhas.map(usuarioDe);
  }

  async removerMembro(tenantId: string, id: string) {
    return this.banco().$transaction(async (tx) => {
      const alvo = await tx.user.findFirst({ where: { id, tenantId }, select: { role: true } });
      if (!alvo) return "ausente" as const;
      if (alvo.role === "master") return "master" as const;
      // As sessões do usuário saem junto (cascade): ele perde o acesso na hora.
      await tx.user.deleteMany({ where: { id, tenantId } });
      await gravarOutbox(tx, tenantId, "remover-usuario", id, { id, tenantId });
      return "removido" as const;
    });
  }

  async buscarPorEmail(email: string): Promise<UsuarioComSenha | null> {
    const linha = await this.banco().user.findUnique({ where: { email } });
    return linha ? { ...usuarioDe(linha), passwordHash: linha.passwordHash, lockedUntil: linha.lockedUntil } : null;
  }

  async buscarUsuario(id: string) {
    const linha = await this.banco().user.findUnique({ where: { id } });
    return linha ? usuarioDe(linha) : null;
  }

  async buscarComSenha(id: string): Promise<UsuarioComSenha | null> {
    const linha = await this.banco().user.findUnique({ where: { id } });
    return linha ? { ...usuarioDe(linha), passwordHash: linha.passwordHash, lockedUntil: linha.lockedUntil } : null;
  }

  async buscarPerfil(id: string) {
    const linha = await this.banco().user.findUnique({ where: { id } });
    return linha ? perfilDe(linha) : null;
  }

  async atualizarPerfil(id: string, dados: DadosDoPerfil) {
    return this.banco().$transaction(async (tx) => {
      const atual = await tx.user.findUnique({ where: { id } });
      if (!atual) return "ausente" as const;
      const campos = (Object.keys(dados) as (keyof DadosDoPerfil)[]).filter((campo) => atual[campo] !== dados[campo]);
      if (campos.length === 0) return perfilDe(atual);
      const salvo = await tx.user.update({ where: { id }, data: dados });
      // O evento diz quais campos mudaram, não os valores: texto livre do usuário não vai para a fila.
      await gravarOutbox(tx, atual.tenantId, "atualizar-perfil", id, { userId: id, campos }, randomUUID());
      return perfilDe(salvo);
    });
  }

  async trocarSenha(id: string, passwordHash: string, manterSessao: string) {
    return this.banco().$transaction(async (tx) => {
      const atual = await tx.user.findUnique({ where: { id }, select: { tenantId: true } });
      if (!atual) return "ausente" as const;
      await tx.user.update({ where: { id }, data: { passwordHash, failedAttempts: 0, lockedUntil: null } });
      const encerradas = await tx.authSession.deleteMany({ where: { userId: id, NOT: { id: manterSessao } } });
      await gravarOutbox(
        tx,
        atual.tenantId,
        "trocar-senha",
        id,
        { userId: id, sessoesEncerradas: encerradas.count },
        randomUUID(),
      );
      return encerradas.count;
    });
  }

  async listarSessoes(userId: string, agora: Date) {
    const linhas = await this.banco().authSession.findMany({
      where: { userId, expiresAt: { gt: agora } },
      orderBy: { createdAt: "desc" },
      select: { id: true, userAgent: true, createdAt: true, expiresAt: true },
    });
    return linhas;
  }

  async encerrarOutras(userId: string, manterSessao: string) {
    return this.banco().$transaction(async (tx) => {
      const dono = await tx.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
      const encerradas = await tx.authSession.deleteMany({ where: { userId, NOT: { id: manterSessao } } });
      if (dono && encerradas.count > 0) {
        await gravarOutbox(
          tx,
          dono.tenantId,
          "encerrar-outras-sessoes",
          userId,
          { userId, sessoesEncerradas: encerradas.count },
          randomUUID(),
        );
      }
      return encerradas.count;
    });
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
    const linha = await this.banco().authSession.findUnique({
      where: { id },
      include: { user: { select: { role: true } } },
    });
    return linha
      ? { tenantId: linha.tenantId, userId: linha.userId, role: papelDe(linha.user.role), expiresAt: linha.expiresAt }
      : null;
  }

  async removerSessao(id: string, motivo: MotivoDoFim) {
    await this.banco().$transaction(async (tx) => {
      const linha = await tx.authSession.findUnique({ where: { id }, select: { tenantId: true, userId: true } });
      if (!linha) return;
      // Duas chamadas ao mesmo tempo podem chegar aqui: só quem de fato apagou registra o evento.
      const apagadas = await tx.authSession.deleteMany({ where: { id } });
      if (apagadas.count === 0) return;
      // O nome difere do "encerrar-sessao" das sessões de finanças, para a tela de Eventos saber de qual se trata.
      await gravarOutbox(tx, linha.tenantId, "encerrar-sessao-de-acesso", linha.userId, { userId: linha.userId, motivo }, randomUUID());
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

// Um valor desconhecido no banco vira o papel de menor privilégio.
function papelDe(valor: string): PapelDoUsuario {
  return PAPEIS.find((papel) => papel === valor) ?? "membro";
}

function usuarioDe(linha: User): Usuario {
  return { id: linha.id, tenantId: linha.tenantId, email: linha.email, name: linha.name, role: papelDe(linha.role) };
}

function perfilDe(linha: User): PerfilGravado {
  return {
    ...usuarioDe(linha),
    headline: linha.headline,
    location: linha.location,
    bio: linha.bio,
    avatarTone: TONS_DO_AVATAR.find((tom) => tom === linha.avatarTone) ?? "brand",
    createdAt: linha.createdAt,
  };
}

function violouUnico(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}
