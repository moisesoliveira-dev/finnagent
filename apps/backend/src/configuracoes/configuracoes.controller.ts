import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { ConfiguracoesService } from "./aplicacao/configuracoes.service.js";
import { interpretarConfiguracao } from "./dominio/pedido.js";
import { BancoIndisponivel, PedidoInvalido } from "../grupos/dominio/erros.js";

const tenantId = z.uuid();
const retornoGoogle = z.object({
  code: z.string().trim().min(1).max(2048),
  state: z.string().trim().min(1).max(80),
  redirectUri: z.string().trim().min(1).max(300),
});

@Controller()
export class ConfiguracoesController {
  constructor(private readonly configuracoes: ConfiguracoesService) {}

  @Get("configuracoes")
  obter(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.configuracoes.obter(this.tenant(tenant)));
  }

  @Put("configuracoes")
  salvar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = interpretarConfiguracao(body);
    if (typeof pedido === "string") throw new BadRequestException(pedido);
    return this.executar(() => this.configuracoes.salvar(this.tenant(tenant), pedido));
  }

  @Get("configuracoes/google/conectar")
  conectar(@Headers("x-tenant-id") tenant: string | undefined, @Query("redirectUri") redirectUri?: string) {
    return this.executar(() => this.configuracoes.iniciarGoogle(this.tenant(tenant), redirectUri ?? ""));
  }

  @Post("configuracoes/google/retorno")
  retorno(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = retornoGoogle.safeParse(body);
    if (!pedido.success) throw new BadRequestException("Não foi possível conectar o Google Calendar.");
    return this.executar(() =>
      this.configuracoes.concluirGoogle(this.tenant(tenant), pedido.data.code, pedido.data.state, pedido.data.redirectUri),
    );
  }

  @Post("configuracoes/google/desconectar")
  desconectar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.configuracoes.desconectar(this.tenant(tenant)));
  }

  private tenant(value: string | undefined) {
    const parsed = tenantId.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Tenant ausente.");
    return parsed.data;
  }

  private async executar<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof BancoIndisponivel) throw new ServiceUnavailableException(error.message);
      if (error instanceof PedidoInvalido) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
