import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AGENDAS, CATEGORIAS_COMPROMISSO } from "@finnagent/contracts";
import { z } from "zod";
import { AgendaService } from "./aplicacao/agenda.service.js";
import { PedidoInvalido } from "./dominio/erros.js";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../grupos/dominio/erros.js";

const tenantId = z.uuid();
const periodo = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const criarCompromisso = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(80),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    time: hora.nullable(),
    calendar: z.enum(AGENDAS),
    category: z.enum(CATEGORIAS_COMPROMISSO),
    endYear: z.number().int().min(2000).max(2100).nullable(),
    endMonth: z.number().int().min(1).max(12).nullable(),
    endDay: z.number().int().min(1).max(31).nullable(),
    entryId: z.uuid().nullable(),
  })
  .superRefine((pedido, contexto) => {
    const ultimo = new Date(pedido.year, pedido.month, 0).getDate();
    if (pedido.day > ultimo) contexto.addIssue({ code: "custom", path: ["day"] });
  });

@Controller()
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get("agenda")
  listar(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Query("year") year: string | undefined,
    @Query("month") month: string | undefined,
  ) {
    const pedido = periodo.safeParse({ year, month });
    if (!pedido.success) throw new BadRequestException("Informe o mês.");
    return this.executar(() =>
      this.agenda.listar(this.tenant(tenant), pedido.data.year, pedido.data.month),
    );
  }

  @Post("compromissos")
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = criarCompromisso.safeParse(body);
    if (!pedido.success) {
      const campo = pedido.error.issues[0]?.path[0];
      if (campo === "title") throw new BadRequestException("Dê um título ao compromisso.");
      if (campo === "day") throw new BadRequestException("Esse dia não existe nesse mês.");
      if (campo === "time") throw new BadRequestException("Informe a hora.");
      if (campo === "entryId") throw new BadRequestException("Escolha um lançamento.");
      if (campo === "category") throw new BadRequestException("Escolha a categoria.");
      const mensagem = pedido.error.issues[0]?.message;
      if (mensagem && pedido.error.issues[0]?.code === "custom") {
        throw new BadRequestException(mensagem);
      }
      throw new BadRequestException("Não foi possível salvar o compromisso.");
    }
    return this.executar(() => this.agenda.criar(this.tenant(tenant), pedido.data));
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
      if (error instanceof Conflito) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
