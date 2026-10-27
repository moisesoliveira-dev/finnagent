import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { BancoIndisponivel, PedidoInvalido } from "../grupos/dominio/erros.js";
import { AuthService } from "./aplicacao/auth.service.js";
import { NaoAutenticado, TentativasEsgotadas } from "./dominio/erros.js";
import type { PedidoAutenticado } from "./sessao.guard.js";

/** O perfil é do usuário da sessão: o id vem do guard, nunca do corpo nem da URL. */
@Controller("perfil")
export class PerfilController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  perfil(@Req() pedido: PedidoAutenticado, @Res({ passthrough: true }) resposta: Response) {
    return this.executar(resposta, () => this.auth.perfil(pedido.usuarioId ?? ""));
  }

  @Patch()
  atualizar(@Req() pedido: PedidoAutenticado, @Body() body: unknown, @Res({ passthrough: true }) resposta: Response) {
    return this.executar(resposta, () => this.auth.atualizarPerfil(pedido.usuarioId ?? "", body));
  }

  @Post("senha")
  @HttpCode(200)
  senha(
    @Req() pedido: PedidoAutenticado,
    @Headers("authorization") autorizacao: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    return this.executar(resposta, () => this.auth.trocarSenha(pedido.usuarioId ?? "", token(autorizacao), body));
  }

  @Get("sessoes")
  sessoes(
    @Req() pedido: PedidoAutenticado,
    @Headers("authorization") autorizacao: string | undefined,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    return this.executar(resposta, () => this.auth.sessoes(pedido.usuarioId ?? "", token(autorizacao)));
  }

  @Post("sessoes/encerrar-outras")
  @HttpCode(200)
  encerrarOutras(
    @Req() pedido: PedidoAutenticado,
    @Headers("authorization") autorizacao: string | undefined,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    return this.executar(resposta, () => this.auth.encerrarOutras(pedido.usuarioId ?? "", token(autorizacao)));
  }

  private async executar<T>(resposta: Response, run: () => Promise<T>) {
    resposta.setHeader("cache-control", "no-store");
    try {
      return await run();
    } catch (error) {
      if (error instanceof BancoIndisponivel) throw new ServiceUnavailableException(error.message);
      if (error instanceof PedidoInvalido) throw new BadRequestException(error.message);
      if (error instanceof NaoAutenticado) throw new UnauthorizedException(error.message);
      if (error instanceof TentativasEsgotadas) {
        const espera = Math.ceil(error.segundos);
        resposta.setHeader("retry-after", String(espera));
        throw new HttpException({ message: error.message, retryAfter: espera }, HttpStatus.TOO_MANY_REQUESTS);
      }
      throw error;
    }
  }
}

function token(autorizacao: string | undefined) {
  return (autorizacao ?? "").replace(/^Bearer /, "").trim();
}
