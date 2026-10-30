import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { BancoIndisponivel, PedidoInvalido } from "../grupos/dominio/erros.js";
import { SoMaster } from "../auth/papel.js";
import { DadosService } from "./aplicacao/dados.service.js";

const tenantId = z.uuid();

// Importar substitui todos os dados da conta e exportar leva todos eles: só o master.
@SoMaster()
@Controller("dados")
export class DadosController {
  constructor(private readonly dados: DadosService) {}

  @Get("exportar")
  @Header("cache-control", "no-store")
  exportar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.dados.exportar(this.tenant(tenant)));
  }

  @Post("importar")
  @HttpCode(200)
  importar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    return this.executar(() => this.dados.importar(this.tenant(tenant), body));
  }

  @Post("zerar")
  @HttpCode(200)
  zerar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.dados.zerar(this.tenant(tenant)));
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
