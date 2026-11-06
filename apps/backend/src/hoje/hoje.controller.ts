import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import { REPETICOES_DE_TAREFA } from "@finnagent/contracts";
import { z } from "zod";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../grupos/dominio/erros.js";
import { HojeService } from "./aplicacao/hoje.service.js";

const tenantId = z.uuid();
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const tarefa = z.object({
  title: z.string().trim().min(1).max(160),
  date: dataIso,
  parentId: z.uuid().nullable().optional(),
  repeat: z.enum(REPETICOES_DE_TAREFA).nullable().optional(),
});
const criarTarefa = tarefa.extend({ id: z.uuid() });
const concluir = z.object({ done: z.boolean() });
const mover = z.object({ parentId: z.uuid().nullable(), beforeId: z.uuid().nullable().optional() });

@Controller()
export class HojeController {
  constructor(private readonly hoje: HojeService) {}

  @Get("hoje")
  dia(@Headers("x-tenant-id") tenant: string | undefined, @Query("date") date: string | undefined) {
    const dia = date ? dataIso.safeParse(date) : null;
    if (dia && !dia.success) throw new BadRequestException("Informe o dia no formato AAAA-MM-DD.");
    return this.executar(() => this.hoje.dia(this.tenant(tenant), dia?.success ? dia.data : undefined));
  }

  @Post("tarefas")
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = criarTarefa.safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escreva a tarefa e o dia dela.");
    const { id, ...dados } = pedido.data;
    return this.executar(() => this.hoje.criar(this.tenant(tenant), id, dados));
  }

  @Patch("tarefas/:id")
  atualizar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    const pedido = tarefa.safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escreva a tarefa e o dia dela.");
    return this.executar(() => this.hoje.atualizar(this.tenant(tenant), this.id(id), pedido.data));
  }

  @Patch("tarefas/:id/concluir")
  concluir(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    const pedido = concluir.safeParse(body);
    if (!pedido.success) throw new BadRequestException("Diga se a tarefa foi feita.");
    return this.executar(() => this.hoje.concluir(this.tenant(tenant), this.id(id), pedido.data.done));
  }

  @Patch("tarefas/:id/mover")
  mover(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    const pedido = mover.safeParse(body);
    if (!pedido.success) throw new BadRequestException("Diga para onde a tarefa vai.");
    return this.executar(() => this.hoje.mover(this.tenant(tenant), this.id(id), pedido.data));
  }

  @Delete("tarefas/:id")
  @HttpCode(204)
  excluir(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    return this.executar(() => this.hoje.excluir(this.tenant(tenant), this.id(id)));
  }

  private id(value: string) {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) throw new NotFoundException("Tarefa não encontrada.");
    return parsed.data;
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
      if (error instanceof Conflito) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
