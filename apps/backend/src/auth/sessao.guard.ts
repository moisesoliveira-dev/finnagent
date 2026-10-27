import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ambienteDe, loginDispensado, type PapelDoUsuario } from "@finnagent/contracts";
import type { Request } from "express";
import { BancoIndisponivel } from "../grupos/dominio/erros.js";
import { AuthService, TENANT_LEGADO, USUARIO_SEM_LOGIN } from "./aplicacao/auth.service.js";
import { SemPermissao } from "./dominio/erros.js";
import { SO_MASTER } from "./papel.js";
import { PUBLICO } from "./publico.js";

export type PedidoAutenticado = Request & { usuarioId?: string; papel?: PapelDoUsuario };

/**
 * Guarda global. O tenant deixa de ser o que o cliente manda: vem da sessão, e o
 * `x-tenant-id` que chegou é sobrescrito antes de qualquer controller ler. Rota marcada com
 * `@SoMaster()` ainda exige o papel master.
 *
 * Em desenvolvimento (`APP_ENV=development`, fora do Railway) quem chega sem sessão válida
 * entra como o usuário "sem login" (master), no tenant dos dados de antes do login.
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
    const alvos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvos)) return true;
    const pedido = contexto.switchToHttp().getRequest<PedidoAutenticado>();
    const cabecalho = pedido.headers.authorization ?? "";
    const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
    try {
      // Uma sessão válida vale sempre, inclusive em desenvolvimento: dá para testar o login de verdade.
      let identidade = await this.auth.resolver(token);
      if (!identidade && loginDispensado(process.env)) {
        identidade = { userId: USUARIO_SEM_LOGIN, tenantId: TENANT_LEGADO, role: "master" };
      }
      if (!identidade) throw new UnauthorizedException("Sessão inválida ou expirada.");
      if (this.reflector.getAllAndOverride<boolean>(SO_MASTER, alvos) && identidade.role !== "master") {
        throw new ForbiddenException(new SemPermissao().message);
      }
      pedido.headers["x-tenant-id"] = identidade.tenantId;
      pedido.usuarioId = identidade.userId;
      pedido.papel = identidade.role;
      return true;
    } catch (error) {
      if (error instanceof BancoIndisponivel) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }
}
