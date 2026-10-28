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
import {
  AJUSTES_DE_DIA_UTIL,
  CATEGORIAS_TRANSACAO,
  CONTAGENS_DE_DIA_UTIL,
  MODOS_TRANSACAO,
  PRIORIDADES_TRANSACAO,
  RECORRENCIAS,
  STATUS_TRANSACAO,
  TIPOS_DE_REGRA,
  TIPOS_TRANSACAO,
} from "@finnagent/contracts";
import { z } from "zod";
import { FinancasService } from "./aplicacao/financas.service.js";
import { PedidoInvalido } from "./dominio/erros.js";
import type { PedidoLancamento } from "./dominio/pedido.js";
import { dataValida } from "./dominio/transacao.js";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../grupos/dominio/erros.js";

const tenantId = z.uuid();
const texto = z.string().trim().min(1).max(160);
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const centavos = z.number().int().gte(-2_147_483_647).lte(2_147_483_647);

const opcional = <T extends z.ZodType>(schema: T) => schema.nullable().catch(null);

const formularioLancamento = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  name: texto,
  description: z.string().trim().max(160),
  justification: texto,
  date: dataIso,
  mode: z.enum(MODOS_TRANSACAO),
  status: z.enum(STATUS_TRANSACAO),
  transactionType: z.enum(TIPOS_TRANSACAO),
  category: z.enum(CATEGORIAS_TRANSACAO),
  priority: z.enum(PRIORIDADES_TRANSACAO),
  cents: centavos,
  installments: opcional(z.number().int().min(1).max(360)),
  installmentNumber: opcional(z.number().int().min(1).max(360)),
  dueDate: opcional(dataIso),
  interestRate: opcional(z.number().min(0).max(1000)),
  nextDueDate: opcional(dataIso),
  recurrence: opcional(z.enum(RECORRENCIAS)),
  recurrenceInterval: opcional(z.number().int().min(1).max(3660)),
  // Sem regra, vale o padrão da categoria nas configurações.
  dueRule: z
    .object({
      tipo: z.enum(TIPOS_DE_REGRA),
      ordem: z.number().int().min(1).max(23).nullable().default(null),
      ajuste: z.enum(AJUSTES_DE_DIA_UTIL),
      contagem: z.enum(CONTAGENS_DE_DIA_UTIL).default("bancaria"),
    })
    .nullable()
    .default(null),
});
const filtroBase = z.object({
  year: z.coerce.number().int().min(2000).max(2100).nullable().catch(null),
  month: z.coerce.number().int().min(1).max(12).nullable().catch(null),
  day: z.coerce.number().int().min(1).max(31).nullable().catch(null),
  groupId: z.uuid().nullable().catch(null),
  category: z.enum(CATEGORIAS_TRANSACAO).nullable().catch(null),
  q: z.string().max(160).catch(""),
});
const anoPedido = z.coerce.number().int().min(2000).max(2100);

const statusPedido = z.object({ status: z.enum(STATUS_TRANSACAO) });
const ocorrenciaPedido = z
  .object({
    status: z.enum(STATUS_TRANSACAO).optional(),
    dueDate: dataIso.optional(),
    plannedCents: z.number().int().gte(-2_147_483_647).lte(2_147_483_647).optional(),
  })
  .refine(
    (pedido) => pedido.status != null || pedido.dueDate != null || pedido.plannedCents != null,
  );
const compromissoPedido = z.object({ commitmentId: z.uuid() });
const mesPedido = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});
const valoresPedido = z.object({
  updates: z
    .array(z.object({ id: z.uuid(), cents: centavos }))
    .min(1)
    .max(50),
});

@Controller()
export class FinancasController {
  constructor(private readonly financas: FinancasService) {}

  @Get("financas")
  listar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.financas.vista(this.tenant(tenant)));
  }

  @Get("financas/base")
  base(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Query() query: Record<string, string | undefined>,
  ) {
    const filtro = filtroBase.parse(query);
    return this.executar(() => this.financas.base(this.tenant(tenant), filtro));
  }

  @Get("financas/geral")
  geral(@Headers("x-tenant-id") tenant: string | undefined, @Query("year") year: string | undefined) {
    const parsed = anoPedido.safeParse(year);
    if (!parsed.success) throw new BadRequestException("Informe o ano.");
    return this.executar(() => this.financas.geral(this.tenant(tenant), parsed.data));
  }

  @Post("lancamentos")
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = this.pedido(body);
    return this.executar(() => this.financas.registrar(this.tenant(tenant), pedido));
  }

  @Delete("lancamentos/:id")
  @HttpCode(204)
  excluir(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    return this.executar(() => this.financas.excluir(this.tenant(tenant), this.id(id)));
  }

  @Patch("lancamentos/:id")
  atualizar(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const origem = body && typeof body === "object" ? body : {};
    const pedido = this.pedido({ ...origem, id: this.id(id) });
    return this.executar(() => this.financas.editar(this.tenant(tenant), pedido));
  }

  @Post("lancamentos/fixos/valor")
  atualizarValor(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = valoresPedido.safeParse(body);
    if (!parsed.success || parsed.data.updates.some((item) => item.cents === 0)) {
      throw new BadRequestException("Informe o valor das transações fixas.");
    }
    return this.executar(() =>
      this.financas.atualizarValorFixo(this.tenant(tenant), parsed.data.updates),
    );
  }

  @Patch("lancamentos/:id/status")
  atualizarStatus(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = statusPedido.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Escolha o status da transação.");
    return this.executar(() =>
      this.financas.atualizarStatus(this.tenant(tenant), this.id(id), parsed.data.status),
    );
  }

  @Patch("lancamentos/:id/ocorrencias/:numero")
  atualizarOcorrencia(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Param("numero") numero: string,
    @Body() body: unknown,
  ) {
    const parsed = ocorrenciaPedido.safeParse(body);
    const number = Number(numero);
    if (!parsed.success || !Number.isInteger(number) || number < 1 || number > 3660) {
      throw new BadRequestException("Não foi possível atualizar a ocorrência.");
    }
    if (parsed.data.dueDate && !dataValida(parsed.data.dueDate)) {
      throw new BadRequestException("Informe uma data válida.");
    }
    if (parsed.data.plannedCents === 0) throw new BadRequestException("Informe o valor.");
    return this.executar(() =>
      this.financas.atualizarOcorrencia(this.tenant(tenant), this.id(id), number, parsed.data),
    );
  }

  @Delete("lancamentos/:id/ocorrencias/:numero")
  excluirOcorrencia(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Param("numero") numero: string,
  ) {
    const number = Number(numero);
    if (!Number.isInteger(number) || number < 1 || number > 3660) {
      throw new BadRequestException("Não foi possível apagar este mês.");
    }
    return this.executar(() => this.financas.excluirOcorrencia(this.tenant(tenant), this.id(id), number));
  }

  @Post("lancamentos/:id/compromisso")
  associar(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = compromissoPedido.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Escolha um compromisso.");
    return this.executar(() =>
      this.financas.associarCompromisso(this.tenant(tenant), this.id(id), parsed.data.commitmentId),
    );
  }

  @Post("lancamentos/:id/parcelas/adiantar")
  adiantarParcelas(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    return this.executar(() => this.financas.adiantar(this.tenant(tenant), this.id(id), "installment"));
  }

  @Post("lancamentos/:id/parcelas/cancelar")
  cancelarParcelas(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    return this.executar(() =>
      this.financas.cancelarSerie(this.tenant(tenant), this.id(id), "installment"),
    );
  }

  @Post("lancamentos/:id/emprestimo/adiantar")
  adiantarEmprestimo(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    return this.executar(() => this.financas.adiantar(this.tenant(tenant), this.id(id), "loan"));
  }

  @Post("lancamentos/:id/emprestimo/cancelar")
  cancelarEmprestimo(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    return this.executar(() => this.financas.cancelarSerie(this.tenant(tenant), this.id(id), "loan"));
  }

  @Post("lancamentos/:id/fixo/cancelar")
  cancelarFixo(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const mes = this.mes(body);
    return this.executar(() =>
      this.financas.ajustarMes(this.tenant(tenant), this.id(id), mes.year, mes.month, "cancelled"),
    );
  }

  @Post("lancamentos/:id/fixo/suspender")
  suspenderFixo(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const mes = this.mes(body);
    return this.executar(() =>
      this.financas.ajustarMes(this.tenant(tenant), this.id(id), mes.year, mes.month, "suspended"),
    );
  }

  private tenant(value: string | undefined) {
    const parsed = tenantId.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Tenant ausente.");
    return parsed.data;
  }

  private id(value: string) {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) throw new BadRequestException("Lançamento não encontrado.");
    return parsed.data;
  }

  private mes(body: unknown) {
    const parsed = mesPedido.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Informe o mês.");
    return parsed.data;
  }

  private pedido(body: unknown): PedidoLancamento {
    const parsed = formularioLancamento.safeParse(body);
    if (!parsed.success) {
      const campo = parsed.error.issues[0]?.path[0];
      if (campo === "sessionId") throw new BadRequestException("Escolha uma sessão.");
      if (campo === "name") throw new BadRequestException("Dê um nome à transação.");
      if (campo === "description") throw new BadRequestException("A descrição pode ter até 160 caracteres.");
      if (campo === "justification") throw new BadRequestException("Informe a justificativa.");
      if (campo === "date") throw new BadRequestException("Informe uma data válida.");
      if (campo === "cents") throw new BadRequestException("Informe o valor.");
      if (campo === "dueRule") throw new BadRequestException("Confira a regra do vencimento.");
      throw new BadRequestException("Não foi possível salvar o lançamento.");
    }
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
