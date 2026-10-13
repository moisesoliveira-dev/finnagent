import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AgendaGoogle, Configuracoes, EstadoGoogle, Preferencias } from "@finnagent/contracts";
import { PedidoInvalido } from "../../grupos/dominio/erros.js";
import { redirectPermitido, urlDeAutorizacao } from "../dominio/google.js";
import { dataDoWorkflow } from "../dominio/pedido.js";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracaoGravada,
  type ConfiguracoesRepositorio,
} from "../portas/configuracoes-repositorio.js";
import { FalhaOAuth, GOOGLE_OAUTH, type GoogleOAuth } from "../portas/google-oauth.js";

@Injectable()
export class ConfiguracoesService {
  constructor(
    @Inject(CONFIGURACOES_REPOSITORIO) private readonly configuracoes: ConfiguracoesRepositorio,
    @Inject(GOOGLE_OAUTH) private readonly google: GoogleOAuth,
  ) {}

  async obter(tenantId: string): Promise<Configuracoes> {
    return this.completar(tenantId, await this.configuracoes.obter(tenantId));
  }

  async salvar(tenantId: string, preferencias: Preferencias): Promise<Configuracoes> {
    const data = dataDoWorkflow(preferencias.workflowDate);
    if (!data) throw new PedidoInvalido("Informe uma data válida.");
    const salvas = await this.configuracoes.salvar(tenantId, preferencias, data);
    return this.completar(tenantId, salvas);
  }

  async iniciarGoogle(tenantId: string, redirectUri: string) {
    if (!redirectPermitido(redirectUri)) throw new PedidoInvalido("Não foi possível iniciar a conexão.");
    const segredos = await this.configuracoes.segredos(tenantId);
    if (!segredos?.clientId || !segredos.clientSecret) {
      throw new PedidoInvalido("Informe o ID e o segredo do cliente Google e salve.");
    }
    const state = randomUUID();
    await this.configuracoes.guardarEstado(tenantId, state);
    return { url: urlDeAutorizacao(segredos.clientId, redirectUri, state) };
  }

  async concluirGoogle(tenantId: string, code: string, state: string, redirectUri: string) {
    if (!redirectPermitido(redirectUri)) throw new PedidoInvalido("Não foi possível conectar o Google Calendar.");
    const segredos = await this.configuracoes.segredos(tenantId);
    if (!segredos?.clientId || !segredos.clientSecret) {
      throw new PedidoInvalido("Salve o cliente Google antes de conectar.");
    }
    if (!state || state !== segredos.oauthState) {
      throw new PedidoInvalido("A conexão expirou. Tente de novo.");
    }
    let tokens: { accessToken: string; refreshToken: string };
    try {
      tokens = await this.google.trocarCodigo({
        clientId: segredos.clientId,
        clientSecret: segredos.clientSecret,
        code,
        redirectUri,
      });
    } catch (error) {
      if (error instanceof FalhaOAuth) throw new PedidoInvalido("Não foi possível conectar o Google Calendar.");
      throw error;
    }
    if (!tokens.refreshToken) {
      throw new PedidoInvalido("O Google não devolveu a permissão. Conecte de novo.");
    }
    let account = "";
    try {
      const agendas = await this.google.agendas(tokens.accessToken);
      account = agendas.find((agenda) => agenda.primary)?.name || agendas[0]?.name || "";
    } catch {
      account = "";
    }
    await this.configuracoes.concluirConexao(tenantId, tokens.refreshToken, account);
    return this.obter(tenantId);
  }

  async desconectar(tenantId: string) {
    await this.configuracoes.desconectar(tenantId);
    return this.obter(tenantId);
  }

  private async completar(tenantId: string, gravada: ConfiguracaoGravada): Promise<Configuracoes> {
    const google = await this.calendarios(gravada, tenantId);
    return { ...gravada, ...google };
  }

  private async calendarios(
    gravada: ConfiguracaoGravada,
    tenantId: string,
  ): Promise<{ google: EstadoGoogle; googleCalendars: AgendaGoogle[] }> {
    if (!gravada.googleConnected) return { google: "desconectado", googleCalendars: [] };
    const segredos = await this.configuracoes.segredos(tenantId);
    if (!segredos?.refreshToken || !segredos.clientId || !segredos.clientSecret) {
      return { google: "erro", googleCalendars: [] };
    }
    try {
      const accessToken = await this.google.accessToken(segredos);
      const agendas = await this.google.agendas(accessToken);
      return {
        google: "sincronizado",
        googleCalendars: agendas.map((agenda) => ({ id: agenda.id, name: agenda.name })),
      };
    } catch {
      return { google: "erro", googleCalendars: [] };
    }
  }
}
