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
import { AgenteIndisponivel, PedidoInvalido } from "./dominio/erros.js";

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
    @Query("abrir") abrir: string | undefined,
  ) {
    const pedido = z
      .object({
        year: z.coerce.number().int().min(2000).max(2100),
        month: z.coerce.number().int().min(1).max(12),
        abrir: z.enum(["pendente"]).optional(),
      })
      .safeParse({ year, month, abrir });
    if (!pedido.success) throw new BadRequestException("Informe o mês.");
    const { year: ano, month: mes } = pedido.data;
    const tenantId = this.tenant(tenant);
    return this.executar(() =>
      pedido.data.abrir ? this.extratos.abrirConferencia(tenantId, ano, mes) : this.extratos.conferencia(tenantId, ano, mes),
    );
  }

  @Post("extratos/cruzamentos")
  cruzar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z
      .object({
        statementId: z.uuid(),
        line: z.number().int().min(1),
        entryId: z.uuid(),
        valor: z.enum(["extrato", "lancamento"]).optional(),
      })
      .safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha o lançamento desta linha.");
    return this.executar(() =>
      this.extratos.confirmar(
        this.tenant(tenant),
        pedido.data.statementId,
        pedido.data.line,
        pedido.data.entryId,
        pedido.data.valor,
      ),
    );
  }

  @Post("extratos/cruzamentos/desfazer")
  desfazer(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z.object({ statementId: z.uuid(), line: z.number().int().min(1) }).safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha a linha cruzada.");
    return this.executar(() => this.extratos.desfazer(this.tenant(tenant), pedido.data.statementId, pedido.data.line));
  }

  @Post("extratos/acumular-lote")
  acumularLote(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z
      .object({
        items: z
          .array(z.object({ statementId: z.uuid(), line: z.number().int().min(1), sessionId: z.uuid() }))
          .min(1)
          .max(500),
      })
      .safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha as linhas e a sessão para lançar.");
    return this.executar(() => this.extratos.acumularVarias(this.tenant(tenant), pedido.data.items));
  }

  @Post("extratos/acumular")
  acumular(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z
      .object({ statementId: z.uuid(), line: z.number().int().min(1), sessionId: z.uuid() })
      .safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha a sessão para acumular a linha.");
    return this.executar(() =>
      this.extratos.acumular(this.tenant(tenant), pedido.data.statementId, pedido.data.line, pedido.data.sessionId),
    );
  }

  @Post("extratos/previa")
  previa(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    this.tenant(tenant);
    const pedido = arquivo.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]));
    return this.executar(() =>
      this.extratos.previa(this.tenant(tenant), pedido.data.filename, pedido.data.content, pedido.data.mapping),
    );
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
    if (campo === "filename") return "Envie um OFX, um CSV ou uma imagem do extrato.";
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
      if (error instanceof BancoIndisponivel || error instanceof AgenteIndisponivel) {
        throw new ServiceUnavailableException(error.message);
      }
      if (error instanceof PedidoInvalido) throw new BadRequestException(error.message);
      if (error instanceof Conflito) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
