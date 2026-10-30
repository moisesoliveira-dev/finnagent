import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  ESQUEMA_DISPOSITIVO_DE_NOTIFICACAO,
  ESQUEMA_PREFERENCIAS_DE_NOTIFICACAO,
  rotaWebDoDestino,
  type CanaisDisponiveis,
  type NotificacoesResposta,
  type PreferenciasDeNotificacao,
} from "@finnagent/contracts";
import { z } from "zod";
import { AuthService, USUARIO_SEM_LOGIN } from "../../auth/aplicacao/auth.service.js";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { NaoEncontrado, PedidoInvalido } from "../../grupos/dominio/erros.js";
import { log } from "../../log.js";
import { VALIDADE_DO_PUSH_MS, canaisDePush, horaNoFuso, type PedidoDeNotificacao } from "../dominio/avisos.js";
import {
  PUSH_DO_CELULAR,
  PUSH_DO_NAVEGADOR,
  type CanalDePush,
  type PushDoNavegador,
} from "../portas/canal-de-push.js";
import {
  NOTIFICACOES_REPOSITORIO,
  type NotificacoesRepositorio,
  type NovaNotificacao,
} from "../portas/notificacoes-repositorio.js";

const POR_PAGINA = 20;
const cursor = z.iso.datetime();
const remocao = z.object({ endpoint: z.string().min(1).max(4096) });

@Injectable()
export class NotificacoesService {
  constructor(
    @Inject(NOTIFICACOES_REPOSITORIO) private readonly repositorio: NotificacoesRepositorio,
    @Inject(PUSH_DO_NAVEGADOR) private readonly navegador: PushDoNavegador,
    @Inject(PUSH_DO_CELULAR) private readonly celular: CanalDePush,
    @Inject(CONFIGURACOES_REPOSITORIO) private readonly configuracoes: ConfiguracoesRepositorio,
    private readonly auth: AuthService,
  ) {}

  /**
   * Cria os avisos para quem quer recebê-los na central. O mesmo fato não avisa duas vezes: a chave junta o
   * usuário e o fato, e a repetição não grava nada. O push sai depois, pelo consumidor de `criar-notificacao`.
   */
  async notificar(tenantId: string, pedidos: PedidoDeNotificacao[]) {
    if (pedidos.length === 0) return 0;
    const usuarios = (await this.auth.listarUsuarios(tenantId)).map((usuario) => usuario.id);
    const preferencias = new Map<string, PreferenciasDeNotificacao>();
    const novas: NovaNotificacao[] = [];
    for (const pedido of pedidos) {
      for (const userId of pedido.userId ? usuarios.filter((id) => id === pedido.userId) : usuarios) {
        if (!preferencias.has(userId)) preferencias.set(userId, await this.repositorio.preferencias(tenantId, userId));
        if (!preferencias.get(userId)?.canais[pedido.tipo].central) continue;
        novas.push({
          id: randomUUID(),
          userId,
          tipo: pedido.tipo,
          titulo: pedido.titulo.slice(0, 160),
          texto: pedido.texto.slice(0, 400),
          destino: pedido.destino,
          chave: `${userId}:${pedido.chave}`,
        });
      }
    }
    return this.repositorio.criar(tenantId, novas);
  }

  async listar(tenantId: string, userId: string, antes: string | undefined): Promise<NotificacoesResposta> {
    const lido = antes ? cursor.safeParse(antes) : null;
    if (lido && !lido.success) throw new PedidoInvalido("Cursor inválido.");
    const [itens, naoLidas] = await Promise.all([
      this.repositorio.listar(tenantId, userId, lido ? new Date(lido.data) : null, POR_PAGINA),
      this.repositorio.contarNaoLidas(tenantId, userId),
    ]);
    return { itens, naoLidas, proxima: itens.length === POR_PAGINA ? (itens.at(-1)?.criadaEm ?? null) : null };
  }

  async contar(tenantId: string, userId: string) {
    return { naoLidas: await this.repositorio.contarNaoLidas(tenantId, userId) };
  }

  async marcarLida(tenantId: string, userId: string, id: string) {
    if (!(await this.repositorio.marcarLida(tenantId, userId, id))) throw new NaoEncontrado("Notificação não encontrada.");
    return this.contar(tenantId, userId);
  }

  async marcarTodas(tenantId: string, userId: string) {
    await this.repositorio.marcarTodas(tenantId, userId);
    return { naoLidas: 0 };
  }

  preferencias(tenantId: string, userId: string) {
    return this.repositorio.preferencias(tenantId, userId);
  }

  async salvarPreferencias(tenantId: string, userId: string, corpo: unknown) {
    exigirConta(userId);
    const lido = ESQUEMA_PREFERENCIAS_DE_NOTIFICACAO.safeParse(corpo);
    if (!lido.success) throw new PedidoInvalido(lido.error.issues[0]?.message ?? "Preferências inválidas.");
    await this.repositorio.salvarPreferencias(tenantId, userId, lido.data);
    return lido.data;
  }

  canais(): CanaisDisponiveis {
    return { navegador: this.navegador.chavePublica(), celular: this.celular.disponivel() };
  }

  async registrarDispositivo(tenantId: string, userId: string, corpo: unknown) {
    exigirConta(userId);
    const lido = ESQUEMA_DISPOSITIVO_DE_NOTIFICACAO.safeParse(corpo);
    if (!lido.success) throw new PedidoInvalido("Aparelho inválido.");
    await this.repositorio.registrarDispositivo(tenantId, userId, lido.data);
  }

  async removerDispositivo(tenantId: string, userId: string, corpo: unknown) {
    const lido = remocao.safeParse(corpo);
    if (!lido.success) throw new PedidoInvalido("Aparelho inválido.");
    await this.repositorio.removerDispositivo(tenantId, userId, lido.data.endpoint);
  }

  /**
   * Envia o push de uma notificação recém-criada, pelos canais que a pessoa ligou e fora do silêncio.
   * Lida, velha ou apagada não sai. A falha de um aparelho não impede os outros.
   */
  async entregar(tenantId: string, id: string, agora = new Date()) {
    const notificacao = await this.repositorio.obter(tenantId, id);
    if (!notificacao || notificacao.lidaEm) return;
    if (agora.getTime() - Date.parse(notificacao.criadaEm) > VALIDADE_DO_PUSH_MS) return;
    const [preferencias, conta] = await Promise.all([
      this.repositorio.preferencias(tenantId, notificacao.userId),
      this.configuracoes.obter(tenantId),
    ]);
    const carga = {
      id: notificacao.id,
      titulo: notificacao.titulo,
      texto: notificacao.texto,
      tipo: notificacao.tipo,
      tela: notificacao.destino.tela,
      alvo: notificacao.destino.id,
      url: rotaWebDoDestino(notificacao.destino),
    };
    for (const canal of canaisDePush(preferencias, notificacao.tipo, horaNoFuso(conta.timezone, agora))) {
      const servico = canal === "celular" ? this.celular : this.navegador;
      if (!servico.disponivel()) continue;
      for (const dispositivo of await this.repositorio.dispositivos(tenantId, notificacao.userId, canal)) {
        const resultado = await servico.enviar(dispositivo, carga);
        if (resultado === "expirado") await this.repositorio.esquecerDispositivo(tenantId, dispositivo.id);
      }
    }
  }

  /** O consumidor do outbox chama aqui; o erro fica no log e o BullMQ tenta de novo. */
  async entregarDoEvento(tenantId: string, payload: unknown) {
    const id = z.object({ id: z.uuid() }).safeParse(payload);
    if (!id.success) {
      log.warn({ tenantId }, "evento criar-notificacao sem id");
      return;
    }
    await this.entregar(tenantId, id.data.id);
  }
}

/** O usuário de desenvolvimento sem login não existe no banco: não guarda preferência nem aparelho. */
function exigirConta(userId: string) {
  if (userId === USUARIO_SEM_LOGIN) {
    throw new PedidoInvalido("Você entrou sem login, em modo de desenvolvimento. Cadastre uma conta para receber notificações.");
  }
}
