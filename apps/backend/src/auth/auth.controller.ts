import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { BancoIndisponivel, PedidoInvalido } from "../grupos/dominio/erros.js";
import { AuthService, type Origem } from "./aplicacao/auth.service.js";
import { CredenciaisInvalidas, EmailEmUso, NaoAutenticado, TentativasEsgotadas } from "./dominio/erros.js";
import { Publico } from "./publico.js";
import type { PedidoAutenticado } from "./sessao.guard.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post("cadastro")
  cadastro(
    @Body() body: unknown,
    @Headers("x-client-ip") ip: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
    @Req() pedido: PedidoAutenticado,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    return this.executar(resposta, () => this.auth.cadastrar(body, origemDe(ip, userAgent, pedido)));
  }

  @Publico()
  @Post("entrar")
  @HttpCode(200)
  entrar(
    @Body() body: unknown,
    @Headers("x-client-ip") ip: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
    @Req() pedido: PedidoAutenticado,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    return this.executar(resposta, () => this.auth.entrar(body, origemDe(ip, userAgent, pedido)));
  }

  @Post("sair")
  @HttpCode(204)
  async sair(
    @Headers("authorization") autorizacao: string | undefined,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    await this.executar(resposta, () => this.auth.sair((autorizacao ?? "").replace(/^Bearer /, "").trim()));
  }

  @Get("eu")
  eu(@Req() pedido: PedidoAutenticado, @Res({ passthrough: true }) resposta: Response) {
    return this.executar(resposta, () => this.auth.eu(pedido.usuarioId ?? ""));
  }

  private async executar<T>(resposta: Response, run: () => Promise<T>) {
    resposta.setHeader("cache-control", "no-store");
    try {
      return await run();
    } catch (error) {
      if (error instanceof BancoIndisponivel) throw new ServiceUnavailableException(error.message);
      if (error instanceof PedidoInvalido) throw new BadRequestException(error.message);
      if (error instanceof EmailEmUso) throw new ConflictException(error.message);
      if (error instanceof CredenciaisInvalidas || error instanceof NaoAutenticado) {
        throw new UnauthorizedException(error.message);
      }
      if (error instanceof TentativasEsgotadas) {
        const espera = Math.ceil(error.segundos);
        resposta.setHeader("retry-after", String(espera));
        throw new HttpException({ message: error.message, retryAfter: espera }, HttpStatus.TOO_MANY_REQUESTS);
      }
      throw error;
    }
  }
}

function origemDe(ip: string | undefined, userAgent: string | undefined, pedido: PedidoAutenticado): Origem {
  return { ip: (ip ?? pedido.ip ?? "desconhecido").slice(0, 64), userAgent: userAgent ?? "" };
}
