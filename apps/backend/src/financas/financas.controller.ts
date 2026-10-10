import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  CATEGORIAS_TRANSACAO,
  MODOS_TRANSACAO,
  PRIORIDADES_TRANSACAO,
  RECORRENCIAS,
  STATUS_TRANSACAO,
  TIPOS_TRANSACAO,
  ajustarTransacao,
  centavosComSinal,
  tipoDaCategoria,
} from "@finnagent/contracts";
import { z } from "zod";
import { FinancasService } from "./aplicacao/financas.service.js";
import { dataValida, partesDaData } from "./dominio/transacao.js";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../grupos/dominio/erros.js";

const tenantId = z.uuid();
const texto = z.string().trim().min(1).max(160);
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const centavos = z.number().int().gte(-2_147_483_647).lte(2_147_483_647);

const criarLancamento = z
  .object({
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
    installments: z.number().int().min(1).max(360).nullable(),
    installmentNumber: z.number().int().min(1).max(360).nullable(),
    dueDate: dataIso.nullable(),
    interestRate: z.number().min(0).max(1000).nullable(),
    nextDueDate: dataIso.nullable(),
    recurrence: z.enum(RECORRENCIAS).nullable(),
    recurrenceInterval: z.number().int().min(1).max(3660).nullable(),
  })
  .superRefine((pedido, contexto) => {
    if (pedido.cents === 0) contexto.addIssue({ code: "custom", path: ["cents"] });
    if (!dataValida(pedido.date)) contexto.addIssue({ code: "custom", path: ["date"] });
    const parcelado = pedido.category === "installment" || pedido.category === "loan";
    if (parcelado && pedido.installments == null) {
      contexto.addIssue({ code: "custom", path: ["installments"] });
    }
    if (!parcelado && pedido.installments != null) {
      contexto.addIssue({ code: "custom", path: ["installments"] });
    }
    if (parcelado && (pedido.installmentNumber == null || pedido.installmentNumber > (pedido.installments ?? 0))) {
      contexto.addIssue({ code: "custom", path: ["installmentNumber"] });
    }
    if (!parcelado && pedido.installmentNumber != null) {
      contexto.addIssue({ code: "custom", path: ["installmentNumber"] });
    }
    const emprestimo = pedido.category === "loan";
    if (emprestimo && (pedido.dueDate == null || pedido.interestRate == null)) {
      contexto.addIssue({ code: "custom", path: ["dueDate"] });
    }
    if (emprestimo && pedido.dueDate != null && !dataValida(pedido.dueDate)) {
      contexto.addIssue({ code: "custom", path: ["dueDate"] });
    }
    if (!emprestimo && (pedido.dueDate != null || pedido.interestRate != null)) {
      contexto.addIssue({ code: "custom", path: ["dueDate"] });
    }
    if (pedido.category === "fixed" && (pedido.nextDueDate == null || !dataValida(pedido.nextDueDate))) {
      contexto.addIssue({ code: "custom", path: ["nextDueDate"] });
    }
    if (pedido.category !== "fixed" && pedido.nextDueDate != null) {
      contexto.addIssue({ code: "custom", path: ["nextDueDate"] });
    }
    const fixa = pedido.category === "fixed";
    if (fixa && (pedido.recurrence == null || pedido.recurrenceInterval == null)) {
      contexto.addIssue({ code: "custom", path: ["recurrence"] });
    }
    if (!fixa && (pedido.recurrence != null || pedido.recurrenceInterval != null)) {
      contexto.addIssue({ code: "custom", path: ["recurrence"] });
    }
  });

const statusPedido = z.object({ status: z.enum(STATUS_TRANSACAO) });
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
    return this.executar(() => this.financas.listar(this.tenant(tenant)));
  }

  @Post("lancamentos")
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = this.pedido(body);
    return this.executar(() => this.financas.criar(this.tenant(tenant), pedido));
  }

  @Patch("lancamentos/:id")
  atualizar(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const origem = body && typeof body === "object" ? body : {};
    const pedido = this.pedido({ ...origem, id: this.id(id) });
    return this.executar(() => this.financas.atualizar(this.tenant(tenant), pedido));
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

  private pedido(body: unknown) {
    const parsed = criarLancamento.safeParse(body);
    if (!parsed.success) {
      const campo = parsed.error.issues[0]?.path[0];
      if (campo === "sessionId") throw new BadRequestException("Escolha uma sessão.");
      if (campo === "name") throw new BadRequestException("Dê um nome à transação.");
      if (campo === "description") throw new BadRequestException("A descrição pode ter até 160 caracteres.");
      if (campo === "recurrence" || campo === "recurrenceInterval") {
        throw new BadRequestException("Informe a recorrência.");
      }
      if (campo === "justification") throw new BadRequestException("Informe a justificativa.");
      if (campo === "date" || campo === "nextDueDate" || campo === "dueDate") {
        throw new BadRequestException("Informe uma data válida.");
      }
      if (campo === "cents") throw new BadRequestException("Informe o valor.");
      if (campo === "installments" || campo === "installmentNumber") {
        throw new BadRequestException("Informe as parcelas.");
      }
      throw new BadRequestException("Não foi possível salvar o lançamento.");
    }
    const pedido = ajustarTransacao(parsed.data);
    const partes = partesDaData(pedido.date);
    const cents = centavosComSinal(pedido.cents, pedido.mode);
    return {
      ...pedido,
      cents,
      type: tipoDaCategoria(pedido.category),
      day: partes.day,
      startYear: partes.year,
      startMonth: partes.month,
    };
  }

  private async executar<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof BancoIndisponivel) {
        throw new ServiceUnavailableException(error.message);
      }
      if (error instanceof Conflito) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
