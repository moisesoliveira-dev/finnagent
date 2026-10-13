import { Inject, Injectable } from "@nestjs/common";
import type { EventoGoogle } from "../dominio/sincronizar.js";
import { PedidoInvalido } from "../dominio/erros.js";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import type { GoogleAgenda } from "../portas/google-agenda.js";
import { ClienteGoogle, FalhaGoogle } from "./cliente-google.js";

@Injectable()
export class GoogleAgendaHttp implements GoogleAgenda {
  constructor(
    @Inject(CONFIGURACOES_REPOSITORIO) private readonly configuracoes: ConfiguracoesRepositorio,
  ) {}

  async listar(tenantId: string): Promise<EventoGoogle[] | "desconectado"> {
    const segredos = await this.configuracoes.segredos(tenantId);
    if (!segredos?.refreshToken || !segredos.clientId || !segredos.clientSecret) {
      return "desconectado";
    }
    const gravada = await this.configuracoes.obter(tenantId);
    if (!gravada.googleCalendarPersonal && !gravada.googleCalendarWork) {
      throw new PedidoInvalido("Escolha os calendários do Google para sincronizar.");
    }
    try {
      const cliente = new ClienteGoogle();
      const accessToken = await cliente.accessToken({
        clientId: segredos.clientId,
        clientSecret: segredos.clientSecret,
        refreshToken: segredos.refreshToken,
      });
      const eventos: EventoGoogle[] = [];
      if (gravada.googleCalendarPersonal) {
        eventos.push(...(await cliente.eventos(accessToken, "Pessoal", gravada.googleCalendarPersonal)));
      }
      if (gravada.googleCalendarWork) {
        eventos.push(...(await cliente.eventos(accessToken, "Trabalho", gravada.googleCalendarWork)));
      }
      return eventos;
    } catch (error) {
      if (error instanceof FalhaGoogle) {
        throw new PedidoInvalido("Não foi possível ler o Google Calendar.");
      }
      throw error;
    }
  }
}
