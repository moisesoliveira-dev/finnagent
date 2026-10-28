import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { SoMaster } from "../auth/papel.js";
import type { PedidoAutenticado } from "../auth/sessao.guard.js";
import { BancoIndisponivel, NaoEncontrado, PedidoInvalido } from "../grupos/dominio/erros.js";
import { IaService } from "./aplicacao/ia.service.js";
import { AssistenteIndisponivel } from "./dominio/erros.js";

const tenantId = z.uuid();
const idDoProvedor = z.uuid();

/** Provedores e comportamento da IA. Todos da conta leem; só o master muda, porque envolve as chaves. */
@Controller("ia")
export class IaController {
  constructor(private readonly ia: IaService) {}

  @Get("configuracao")
  obter(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado) {
    return this.executar(() => this.ia.obter(this.tenant(tenant), pedido.papel));
  }

  @SoMaster()
  @Post("provedores")
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    return this.executar(() => this.ia.criarProvedor(this.tenant(tenant), body));
  }

  @SoMaster()
  @Post("provedores/testar")
  @HttpCode(200)
  testar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    return this.executar(() => this.ia.testar(this.tenant(tenant), body));
  }

  @SoMaster()
  @Patch("provedores/:id")
  atualizar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    return this.executar(() => this.ia.atualizarProvedor(this.tenant(tenant), this.provedor(id), body));
  }

  @SoMaster()
  @Delete("provedores/:id")
  @HttpCode(204)
  async remover(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    await this.executar(() => this.ia.removerProvedor(this.tenant(tenant), this.provedor(id)));
  }

  @SoMaster()
  @Put("assistente")
  salvar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    return this.executar(() => this.ia.salvarAssistente(this.tenant(tenant), body));
  }

  private tenant(value: string | undefined) {
    const parsed = tenantId.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Tenant ausente.");
    return parsed.data;
  }

  private provedor(id: string) {
    const parsed = idDoProvedor.safeParse(id);
    if (!parsed.success) throw new NotFoundException("Provedor não encontrado.");
    return parsed.data;
  }

  private async executar<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof BancoIndisponivel) throw new ServiceUnavailableException(error.message);
      if (error instanceof AssistenteIndisponivel) throw new ServiceUnavailableException(error.message);
      if (error instanceof PedidoInvalido) throw new BadRequestException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message || "Provedor não encontrado.");
      throw error;
    }
  }
}
