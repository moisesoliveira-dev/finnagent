import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ESQUEMA_FILTRO_DE_EVENTOS, ESQUEMA_FILTRO_DO_HISTORICO } from "@finnagent/contracts";
import { z } from "zod";
import { BancoIndisponivel, NaoEncontrado } from "../grupos/dominio/erros.js";
import { EventosService } from "./aplicacao/eventos.service.js";

const tenantId = z.uuid();
const idDoEvento = z.uuid();

@Controller("eventos")
export class EventosController {
  constructor(private readonly eventos: EventosService) {}

  @Get()
  listar(@Headers("x-tenant-id") tenant: string | undefined, @Query() query: Record<string, string | undefined>) {
    const filtro = ESQUEMA_FILTRO_DE_EVENTOS.parse(query);
    return this.executar(() => this.eventos.pagina(this.tenant(tenant), filtro));
  }

  @Get("historico")
  historico(@Headers("x-tenant-id") tenant: string | undefined, @Query() query: Record<string, string | undefined>) {
    const filtro = ESQUEMA_FILTRO_DO_HISTORICO.parse(query);
    return this.executar(() => this.eventos.historico(this.tenant(tenant), filtro));
  }

  @Get(":id")
  detalhe(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    const parsed = idDoEvento.safeParse(id);
    if (!parsed.success) throw new NotFoundException("Evento não encontrado.");
    return this.executar(() => this.eventos.detalhe(this.tenant(tenant), parsed.data));
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
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
