import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { BancoIndisponivel } from "../grupos/dominio/erros.js";
import { RelatoriosService } from "./aplicacao/relatorios.service.js";
import { PedidoInvalido } from "./dominio/erros.js";

const tenantId = z.uuid();
const ano = z.coerce.number().int().min(2000).max(2100);

@Controller("relatorios")
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get()
  listar(@Headers("x-tenant-id") tenant: string | undefined, @Query("year") year?: string) {
    const pedido = year === undefined ? { success: true as const, data: undefined } : ano.safeParse(year);
    if (!pedido.success) throw new BadRequestException("Ano inválido.");
    return this.executar(() => this.relatorios.listar(this.tenant(tenant), pedido.data));
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
      if (error instanceof BancoIndisponivel) {
        throw new ServiceUnavailableException(error.message);
      }
      if (error instanceof PedidoInvalido) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
