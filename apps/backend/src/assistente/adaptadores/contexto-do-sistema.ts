import { Inject, Injectable } from "@nestjs/common";
import { AuthService } from "../../auth/aplicacao/auth.service.js";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { diaNoFuso } from "../../financas/dominio/vista.js";
import type { ContextoDoAssistente } from "../portas/contexto-do-assistente.js";

@Injectable()
export class ContextoDoSistema implements ContextoDoAssistente {
  constructor(
    @Inject(CONFIGURACOES_REPOSITORIO) private readonly configuracoes: ConfiguracoesRepositorio,
    private readonly auth: AuthService,
  ) {}

  async obter(tenantId: string, userId: string) {
    const [preferencias, usuario] = await Promise.all([
      this.configuracoes.obter(tenantId),
      this.auth.eu(userId).catch(() => null),
    ]);
    const dia = diaNoFuso(preferencias.timezone);
    // O dia da semana ajuda o modelo com "sexta que vem" e "amanhã".
    const semana = new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
    return { hoje: `${dia} (${semana})`, usuario: usuario?.name ?? "", fuso: preferencias.timezone };
  }
}
