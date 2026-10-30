import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  TELAS_DE_DESTINO,
  TIPOS_DE_NOTIFICACAO,
  preferenciasDeNotificacaoDe,
  type CanalDeNotificacao,
  type DispositivoDeNotificacao,
  type Notificacao,
  type PreferenciasDeNotificacao,
  type TelaDeDestino,
  type TipoDeNotificacao,
} from "@finnagent/contracts";
import type { Notification, Prisma } from "@prisma/client";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { NotificacoesRepositorio, NovaNotificacao } from "../portas/notificacoes-repositorio.js";

@Injectable()
export class PrismaNotificacoesRepositorio implements NotificacoesRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async criar(tenantId: string, itens: NovaNotificacao[]) {
    if (itens.length === 0) return 0;
    return this.banco().$transaction(async (tx) => {
      let criadas = 0;
      for (const item of itens) {
        const { count } = await tx.notification.createMany({
          data: [
            {
              id: item.id,
              tenantId,
              userId: item.userId,
              kind: item.tipo,
              title: item.titulo,
              body: item.texto,
              target: item.destino.tela,
              targetId: item.destino.id,
              key: item.chave,
            },
          ],
          skipDuplicates: true,
        });
        if (count === 0) continue;
        criadas += 1;
        await gravarOutbox(tx, tenantId, "criar-notificacao", item.id, { id: item.id, userId: item.userId, tipo: item.tipo });
      }
      return criadas;
    });
  }

  async listar(tenantId: string, userId: string, antes: Date | null, limite: number) {
    const linhas = await this.banco().notification.findMany({
      where: { tenantId, userId, ...(antes ? { createdAt: { lt: antes } } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite,
    });
    return linhas.map(notificacaoDe);
  }

  contarNaoLidas(tenantId: string, userId: string) {
    return this.banco().notification.count({ where: { tenantId, userId, readAt: null } });
  }

  async obter(tenantId: string, id: string) {
    const linha = await this.banco().notification.findFirst({ where: { id, tenantId } });
    return linha ? { ...notificacaoDe(linha), userId: linha.userId } : null;
  }

  async marcarLida(tenantId: string, userId: string, id: string) {
    return this.banco().$transaction(async (tx) => {
      const existe = await tx.notification.findFirst({ where: { id, tenantId, userId }, select: { readAt: true } });
      if (!existe) return false;
      if (existe.readAt) return true;
      await tx.notification.updateMany({ where: { id, tenantId, userId }, data: { readAt: new Date() } });
      await gravarOutbox(tx, tenantId, "ler-notificacao", id, { id, userId });
      return true;
    });
  }

  async marcarTodas(tenantId: string, userId: string) {
    return this.banco().$transaction(async (tx) => {
      const agora = new Date();
      const { count } = await tx.notification.updateMany({ where: { tenantId, userId, readAt: null }, data: { readAt: agora } });
      if (count > 0) {
        await gravarOutbox(tx, tenantId, "ler-todas-as-notificacoes", userId, { userId, total: count }, agora.toISOString());
      }
      return count;
    });
  }

  async preferencias(tenantId: string, userId: string) {
    const linha = await this.banco().notificationSetting.findFirst({ where: { userId, tenantId } });
    if (!linha) return preferenciasDeNotificacaoDe(null);
    return preferenciasDeNotificacaoDe({
      canais: linha.channels,
      silencio: { ativo: linha.quietOn, inicio: linha.quietStart, fim: linha.quietEnd },
    });
  }

  async salvarPreferencias(tenantId: string, userId: string, preferencias: PreferenciasDeNotificacao) {
    await this.banco().$transaction(async (tx) => {
      const dados = {
        channels: preferencias.canais as unknown as Prisma.InputJsonValue,
        quietOn: preferencias.silencio.ativo,
        quietStart: preferencias.silencio.inicio,
        quietEnd: preferencias.silencio.fim,
      };
      await tx.notificationSetting.upsert({
        where: { userId },
        create: { userId, tenantId, ...dados },
        update: dados,
      });
      await gravarOutbox(tx, tenantId, "salvar-preferencias-de-notificacao", userId, preferencias, marcaDe(preferencias));
    });
  }

  async registrarDispositivo(tenantId: string, userId: string, dispositivo: DispositivoDeNotificacao) {
    const navegador = dispositivo.tipo === "navegador";
    const endpoint = navegador ? dispositivo.endpoint : dispositivo.token;
    const dados = {
      tenantId,
      userId,
      kind: dispositivo.tipo,
      p256dh: navegador ? dispositivo.chaves.p256dh : "",
      auth: navegador ? dispositivo.chaves.auth : "",
      platform: navegador ? "" : dispositivo.plataforma,
      lastSeenAt: new Date(),
    };
    await this.banco().$transaction(async (tx) => {
      const id = randomUUID();
      const gravado = await tx.pushDevice.upsert({
        where: { endpoint },
        create: { id, endpoint, ...dados },
        update: dados,
        select: { id: true },
      });
      const payload = { id: gravado.id, userId, tipo: dispositivo.tipo };
      await gravarOutbox(tx, tenantId, "registrar-dispositivo", gravado.id, payload, marcaDe(payload));
    });
  }

  async removerDispositivo(tenantId: string, userId: string, endpoint: string) {
    return this.banco().$transaction(async (tx) => {
      const alvo = await tx.pushDevice.findFirst({ where: { endpoint, tenantId, userId }, select: { id: true } });
      if (!alvo) return false;
      await tx.pushDevice.deleteMany({ where: { id: alvo.id, tenantId } });
      await gravarOutbox(tx, tenantId, "remover-dispositivo", alvo.id, { id: alvo.id, userId });
      return true;
    });
  }

  async dispositivos(tenantId: string, userId: string, canal: Exclude<CanalDeNotificacao, "central">) {
    const linhas = await this.banco().pushDevice.findMany({ where: { tenantId, userId, kind: canal } });
    return linhas.map((linha) => ({
      id: linha.id,
      canal,
      endpoint: linha.endpoint,
      p256dh: linha.p256dh,
      auth: linha.auth,
      plataforma: linha.platform,
    }));
  }

  async esquecerDispositivo(tenantId: string, id: string) {
    await this.banco().$transaction(async (tx) => {
      const { count } = await tx.pushDevice.deleteMany({ where: { id, tenantId } });
      if (count > 0) await gravarOutbox(tx, tenantId, "esquecer-dispositivo", id, { id });
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function notificacaoDe(linha: Notification): Notificacao {
  return {
    id: linha.id,
    tipo: (TIPOS_DE_NOTIFICACAO as readonly string[]).includes(linha.kind) ? (linha.kind as TipoDeNotificacao) : "vencimentos",
    titulo: linha.title,
    texto: linha.body,
    destino: {
      tela: (TELAS_DE_DESTINO as readonly string[]).includes(linha.target) ? (linha.target as TelaDeDestino) : "financas",
      id: linha.targetId,
    },
    criadaEm: linha.createdAt.toISOString(),
    lidaEm: linha.readAt?.toISOString() ?? null,
  };
}
