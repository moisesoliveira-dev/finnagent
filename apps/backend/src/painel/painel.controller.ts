import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ESCOPOS_PAINEL } from "@finnagent/contracts";
import { z } from "zod";
import { BancoIndisponivel } from "../grupos/dominio/erros.js";
import { PainelService } from "./aplicacao/painel.service.js";
import { PedidoInvalido } from "./dominio/erros.js";

const tenantId = z.uuid();
const pedido = z.object({
  scope: z.enum(ESCOPOS_PAINEL),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
  day: z.coerce.number().int().min(1).max(31).optional(),
});

@Controller("painel")
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get()
  listar(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Query("scope") scope?: string,
    @Query("year") year?: string,
    @Query("month") month?: string,
    @Query("day") day?: string,
  ) {
    const parsed = pedido.safeParse({
      scope,
      year,
      month: month === undefined || month === "" ? undefined : month,
      day: day === undefined || day === "" ? undefined : day,
    });
    if (!parsed.success) throw new BadRequestException("Informe o período.");
    return this.executar(() =>
      this.painel.listar(
        this.tenant(tenant),
        parsed.data.scope,
        parsed.data.year,
        parsed.data.month ?? null,
        parsed.data.day ?? null,
      ),
    );
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
