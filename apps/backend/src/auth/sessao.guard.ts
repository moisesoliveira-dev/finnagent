import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ambienteDe, loginDispensado } from "@finnagent/contracts";
import type { Request } from "express";
import { BancoIndisponivel } from "../grupos/dominio/erros.js";
import { AuthService, TENANT_LEGADO, USUARIO_SEM_LOGIN } from "./aplicacao/auth.service.js";
import { PUBLICO } from "./publico.js";

export type PedidoAutenticado = Request & { usuarioId?: string };

/**
 * Guarda global. O tenant deixa de ser o que o cliente manda: vem da sessão, e o
 * `x-tenant-id` que chegou é sobrescrito antes de qualquer controller ler.
 *
 * Em desenvolvimento (`APP_ENV=development`, fora do Railway) quem chega sem sessão válida
 * entra como o usuário "sem login", no tenant dos dados de antes do login.
 */
@Injectable()
export class SessaoGuard implements CanActivate, OnModuleInit {
  private readonly log = new Logger("Ambiente");

  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  onModuleInit() {
    if (loginDispensado(process.env)) {
      this.log.warn("APP_ENV=development: o login está DISPENSADO. Não use este modo em produção.");
    } else if (ambienteDe(process.env) === "development") {
      this.log.error("APP_ENV=development ignorado porque este serviço roda no Railway. O login segue obrigatório.");
    }
  }

  async canActivate(contexto: ExecutionContext) {
    const aberta = this.reflector.getAllAndOverride<boolean>(PUBLICO, [contexto.getHandler(), contexto.getClass()]);
    if (aberta) return true;
    const pedido = contexto.switchToHttp().getRequest<PedidoAutenticado>();
    const cabecalho = pedido.headers.authorization ?? "";
    const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
    try {
      // Uma sessão válida vale sempre, inclusive em desenvolvimento: dá para testar o login de verdade.
      const sessao = await this.auth.resolver(token);
      if (sessao) {
        pedido.headers["x-tenant-id"] = sessao.tenantId;
        pedido.usuarioId = sessao.userId;
        return true;
      }
      if (loginDispensado(process.env)) {
        pedido.headers["x-tenant-id"] = TENANT_LEGADO;
        pedido.usuarioId = USUARIO_SEM_LOGIN;
        return true;
      }
      throw new UnauthorizedException("Sessão inválida ou expirada.");
    } catch (error) {
      if (error instanceof BancoIndisponivel) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }
}
