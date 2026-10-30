import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import type { PedidoAutenticado } from "../auth/sessao.guard.js";
import { BancoIndisponivel, NaoEncontrado, PedidoInvalido } from "../grupos/dominio/erros.js";
import { NotificacoesService } from "./aplicacao/notificacoes.service.js";

const tenantId = z.uuid();

/** As notificações são do usuário da sessão: o id vem do guard, nunca do corpo nem da URL. */
@Controller("notificacoes")
export class NotificacoesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get()
  listar(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado, @Query("antes") antes: string | undefined) {
    return this.executar(() => this.notificacoes.listar(this.tenant(tenant), this.usuario(pedido), antes));
  }

  @Get("contagem")
  contar(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado) {
    return this.executar(() => this.notificacoes.contar(this.tenant(tenant), this.usuario(pedido)));
  }

  @Post("lidas")
  @HttpCode(200)
  marcarTodas(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado) {
    return this.executar(() => this.notificacoes.marcarTodas(this.tenant(tenant), this.usuario(pedido)));
  }

  @Post(":id/lida")
  @HttpCode(200)
  marcarLida(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado, @Param("id") id: string) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Notificação não encontrada.");
    return this.executar(() => this.notificacoes.marcarLida(this.tenant(tenant), this.usuario(pedido), id));
  }

  @Get("preferencias")
  preferencias(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado) {
    return this.executar(() => this.notificacoes.preferencias(this.tenant(tenant), this.usuario(pedido)));
  }

  @Put("preferencias")
  salvarPreferencias(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado, @Body() body: unknown) {
    return this.executar(() => this.notificacoes.salvarPreferencias(this.tenant(tenant), this.usuario(pedido), body));
  }

  @Get("canais")
  canais() {
    return this.notificacoes.canais();
  }

  @Post("dispositivos")
  @HttpCode(204)
  registrar(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado, @Body() body: unknown) {
    return this.executar(() => this.notificacoes.registrarDispositivo(this.tenant(tenant), this.usuario(pedido), body));
  }

  @Post("dispositivos/remover")
  @HttpCode(204)
  remover(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado, @Body() body: unknown) {
    return this.executar(() => this.notificacoes.removerDispositivo(this.tenant(tenant), this.usuario(pedido), body));
  }

  private tenant(value: string | undefined) {
    const parsed = tenantId.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Tenant ausente.");
    return parsed.data;
  }

  private usuario(pedido: PedidoAutenticado) {
    if (!pedido.usuarioId) throw new BadRequestException("Usuário ausente.");
    return pedido.usuarioId;
  }

  private async executar<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof BancoIndisponivel) throw new ServiceUnavailableException(error.message);
      if (error instanceof PedidoInvalido) throw new BadRequestException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
