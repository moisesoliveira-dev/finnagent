import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AGENDAS,
  CATEGORIAS_COMPROMISSO,
  FUSOS_AGENDA,
  STATUS_COMPROMISSO,
} from "@finnagent/contracts";
import { z } from "zod";
import { AgendaService } from "./aplicacao/agenda.service.js";
import { PedidoInvalido } from "./dominio/erros.js";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../grupos/dominio/erros.js";

const tenantId = z.uuid();
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const periodo = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
const camposCompromisso = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(160).default(""),
  location: z.string().trim().max(160).default(""),
  allDay: z.boolean().default(false),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  time: hora.nullable(),
  endTime: hora.nullable(),
  calendar: z.enum(AGENDAS),
  timezone: z.enum(FUSOS_AGENDA),
  category: z.enum(CATEGORIAS_COMPROMISSO),
  endYear: z.number().int().min(2000).max(2100).nullable(),
  endMonth: z.number().int().min(1).max(12).nullable(),
  endDay: z.number().int().min(1).max(31).nullable(),
  entryId: z.uuid().nullable(),
  sessionId: z.uuid().nullable().default(null),
});

function validarCompromisso(
  pedido: { year: number; month: number; day: number; allDay: boolean; time: string | null; endTime: string | null },
  contexto: z.RefinementCtx,
) {
  const ultimo = new Date(pedido.year, pedido.month, 0).getDate();
  if (pedido.day > ultimo) contexto.addIssue({ code: "custom", message: "Esse dia não existe nesse mês.", path: ["day"] });
  if (!pedido.allDay && (!pedido.time || !pedido.endTime)) {
    contexto.addIssue({ code: "custom", message: "Informe a hora inicial e a final.", path: ["time"] });
  }
}

const criarCompromisso = camposCompromisso.superRefine(validarCompromisso);
const atualizarCompromisso = camposCompromisso.omit({ id: true }).superRefine(validarCompromisso);
const fuso = z.object({
  name: z.enum(AGENDAS),
  timezone: z.enum(FUSOS_AGENDA),
});
const status = z.object({ status: z.enum(STATUS_COMPROMISSO) });
const destino = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
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

  @Post("agenda/sincronizar")
  sincronizar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.agenda.sincronizarGoogleCalendar(this.tenant(tenant)));
  }

  @Patch("calendarios")
  fuso(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = fuso.safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha o fuso da agenda.");
    return this.executar(() =>
      this.agenda.atualizarFuso(this.tenant(tenant), pedido.data.name, pedido.data.timezone),
    );
  }

  @Post("compromissos")
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = criarCompromisso.safeParse(body);
    if (!pedido.success) {
      const issue = pedido.error.issues[0];
      const campo = issue?.path[0];
      if (issue?.code === "custom" && issue.message) throw new BadRequestException(issue.message);
      if (campo === "title") throw new BadRequestException("Dê um título ao compromisso.");
      if (campo === "day") throw new BadRequestException("Esse dia não existe nesse mês.");
      if (campo === "time" || campo === "endTime") throw new BadRequestException("Informe a hora.");
      if (campo === "entryId") throw new BadRequestException("Escolha um lançamento.");
      if (campo === "category") throw new BadRequestException("Escolha a categoria.");
      if (campo === "timezone") throw new BadRequestException("Escolha o fuso da agenda.");
      throw new BadRequestException("Não foi possível salvar o compromisso.");
    }
    return this.executar(() => this.agenda.criar(this.tenant(tenant), pedido.data));
  }

  @Patch("compromissos/:id")
  atualizar(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const identificador = z.uuid().safeParse(id);
    const pedido = atualizarCompromisso.safeParse(body);
    if (!identificador.success) throw new BadRequestException("Compromisso não encontrado.");
    if (!pedido.success) {
      const issue = pedido.error.issues[0];
      const campo = issue?.path[0];
      if (issue?.code === "custom" && issue.message) throw new BadRequestException(issue.message);
      if (campo === "title") throw new BadRequestException("Dê um título ao compromisso.");
      if (campo === "day") throw new BadRequestException("Esse dia não existe nesse mês.");
      if (campo === "time" || campo === "endTime") throw new BadRequestException("Informe a hora.");
      if (campo === "entryId") throw new BadRequestException("Escolha um lançamento.");
      throw new BadRequestException("Não foi possível salvar o compromisso.");
    }
    return this.executar(() => this.agenda.atualizar(this.tenant(tenant), identificador.data, pedido.data));
  }

  @Post("compromissos/:id/mover")
  mover(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const identificador = z.uuid().safeParse(id);
    const pedido = destino.safeParse(body);
    if (!identificador.success) throw new BadRequestException("Compromisso não encontrado.");
    if (!pedido.success) throw new BadRequestException("Esse dia não existe nesse mês.");
    if (pedido.data.day > new Date(pedido.data.year, pedido.data.month, 0).getDate()) {
      throw new BadRequestException("Esse dia não existe nesse mês.");
    }
    return this.executar(() => this.agenda.mover(this.tenant(tenant), identificador.data, pedido.data));
  }

  @Delete("compromissos/:id")
  excluir(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    const identificador = z.uuid().safeParse(id);
    if (!identificador.success) throw new BadRequestException("Compromisso não encontrado.");
    return this.executar(() => this.agenda.excluir(this.tenant(tenant), identificador.data));
  }

  @Patch("compromissos/:id/status")
  status(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const pedido = status.safeParse(body);
    const identificador = z.uuid().safeParse(id);
    if (!identificador.success) throw new BadRequestException("Compromisso não encontrado.");
    if (!pedido.success) throw new BadRequestException("Escolha o status do compromisso.");
    return this.executar(() =>
      this.agenda.atualizarStatus(this.tenant(tenant), identificador.data, pedido.data.status),
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
      if (error instanceof Conflito) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
