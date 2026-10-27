import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { BancoIndisponivel } from "../grupos/dominio/erros.js";
import { AuthService } from "./aplicacao/auth.service.js";
import { PUBLICO } from "./publico.js";

export type PedidoAutenticado = Request & { usuarioId?: string };

/**
 * Guarda global. O tenant deixa de ser o que o cliente manda: vem da sessão, e o
 * `x-tenant-id` que chegou é sobrescrito antes de qualquer controller ler.
 */
@Injectable()
export class SessaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(contexto: ExecutionContext) {
    const aberta = this.reflector.getAllAndOverride<boolean>(PUBLICO, [contexto.getHandler(), contexto.getClass()]);
    if (aberta) return true;
    const pedido = contexto.switchToHttp().getRequest<PedidoAutenticado>();
    const cabecalho = pedido.headers.authorization ?? "";
    const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
    try {
      const sessao = await this.auth.resolver(token);
      if (!sessao) throw new UnauthorizedException("Sessão inválida ou expirada.");
      pedido.headers["x-tenant-id"] = sessao.tenantId;
      pedido.usuarioId = sessao.userId;
      return true;
    } catch (error) {
      if (error instanceof BancoIndisponivel) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }
}
