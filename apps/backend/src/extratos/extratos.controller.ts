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
  Post,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../grupos/dominio/erros.js";
import { ExtratosService } from "./aplicacao/extratos.service.js";
import { PedidoInvalido } from "./dominio/erros.js";

const tenantId = z.uuid();
const mapeamento = z.object({
  date: z.number().int().min(0).max(40),
  description: z.number().int().min(0).max(40),
  amount: z.number().int().min(0).max(40),
});
const arquivo = z.object({
  filename: z.string().trim().min(1).max(180),
  content: z.string().min(1).max(8_000_000),
  mapping: mapeamento.nullable(),
});
const criarExtrato = arquivo
  .extend({
    id: z.uuid(),
    accountId: z.uuid().nullable(),
    accountName: z.string().trim().min(1).max(80).nullable(),
  })
  .superRefine((pedido, contexto) => {
    if (!pedido.accountId && !pedido.accountName) {
      contexto.addIssue({ code: "custom", message: "Escolha a conta.", path: ["accountId"] });
    }
  });

@Controller()
export class ExtratosController {
  constructor(private readonly extratos: ExtratosService) {}

  @Get("extratos")
  listar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.extratos.listar(this.tenant(tenant)));
  }

  @Get("extratos/conferencia")
  conferencia(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Query("year") year: string | undefined,
    @Query("month") month: string | undefined,
  ) {
    const pedido = z
      .object({
        year: z.coerce.number().int().min(2000).max(2100),
        month: z.coerce.number().int().min(1).max(12),
      })
      .safeParse({ year, month });
    if (!pedido.success) throw new BadRequestException("Informe o mês.");
    return this.executar(() => this.extratos.conferencia(this.tenant(tenant), pedido.data.year, pedido.data.month));
  }

  @Post("extratos/cruzamentos")
  cruzar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z.object({ statementId: z.uuid(), line: z.number().int().min(1) }).safeParse(body);
    if (!pedido.success) throw new BadRequestException("Não foi possível confirmar o cruzamento.");
    return this.executar(() => this.extratos.confirmar(this.tenant(tenant), pedido.data.statementId, pedido.data.line));
  }

  @Post("extratos/previa")
  previa(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    this.tenant(tenant);
    const pedido = arquivo.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]));
    return this.executar(() => Promise.resolve(this.extratos.previa(pedido.data.filename, pedido.data.content, pedido.data.mapping)));
  }

  @Post("extratos")
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = criarExtrato.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]));
    return this.executar(() => this.extratos.criar(this.tenant(tenant), pedido.data));
  }

  @Get("extratos/:id/linhas")
  linhas(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Query("erros") erros: string | undefined,
  ) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException("Extrato não encontrado.");
    return this.executar(() => this.extratos.linhas(this.tenant(tenant), id, erros === "1"));
  }

  @Post("extratos/:id/reprocessar")
  reprocessar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException("Extrato não encontrado.");
    return this.executar(() => this.extratos.reprocessar(this.tenant(tenant), id));
  }

  @Delete("extratos/:id")
  @HttpCode(204)
  excluir(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException("Extrato não encontrado.");
    return this.executar(async () => {
      await this.extratos.excluir(this.tenant(tenant), id);
    });
  }

  private mensagem(issue: { path: PropertyKey[]; message: string; code: string } | undefined) {
    const campo = issue?.path[0];
    if (campo === "accountId" || campo === "accountName") return "Escolha a conta.";
    if (campo === "filename") return "Envie um arquivo OFX ou CSV.";
    if (campo === "mapping") return "Indique as colunas do CSV.";
    if (issue?.code === "custom" && issue.message) return issue.message;
    return "Não foi possível importar o extrato.";
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
      if (error instanceof Conflito) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
