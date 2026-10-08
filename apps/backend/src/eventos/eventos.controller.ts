import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { BancoIndisponivel } from "../grupos/dominio/erros.js";
import { EventosService } from "./aplicacao/eventos.service.js";

const tenantId = z.uuid();

@Controller("eventos")
export class EventosController {
  constructor(private readonly eventos: EventosService) {}

  @Get()
  listar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.eventos.listar(this.tenant(tenant)));
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
      throw error;
    }
  }
}
