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
  ServiceUnavailableException,
} from "@nestjs/common";
import { TIPOS_DE_CONTA } from "@finnagent/contracts";
import { z } from "zod";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../grupos/dominio/erros.js";
import { ContasService } from "./aplicacao/contas.service.js";

const tenantId = z.uuid();
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const conta = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(TIPOS_DE_CONTA).default("conta"),
  openingCents: z.number().int().gte(-2_147_483_647).lte(2_147_483_647).default(0),
  // Ausente: hoje na criação, a data gravada na edição. null: sem data (tudo conta).
  openingOn: dataIso.nullable().optional(),
  // Cartão. Ausente mantém o que está.
  closingDay: z.number().int().min(1).max(28).nullable().optional(),
  dueDay: z.number().int().min(1).max(28).nullable().optional(),
  limitCents: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
});
const transferencia = z.object({
  fromAccountId: z.uuid(),
  toAccountId: z.uuid(),
  cents: z.number().int().min(1).max(2_147_483_647),
  date: dataIso,
  note: z.string().trim().max(160).optional(),
});
const pagamentoDaFatura = z.object({
  fromAccountId: z.uuid(),
  cents: z.number().int().min(1).max(2_147_483_647),
  date: dataIso,
  month: z.string().regex(/^\d{4}-\d{2}$/),
});
const criarConta = conta.extend({ id: z.uuid() });
const ajuste = z.object({
  saldoCents: z.number().int().gte(-2_147_483_647).lte(2_147_483_647),
  date: dataIso,
  foraDaSobra: z.boolean().default(false),
});

@Controller()
export class ContasController {
  constructor(private readonly contas: ContasService) {}

  @Get("contas")
  listar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.contas.listar(this.tenant(tenant)));
  }

  @Post("contas")
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = criarConta.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]?.path[0]));
    const { id, ...dados } = pedido.data;
    return this.executar(() => this.contas.criar(this.tenant(tenant), id, dados));
  }

  @Patch("contas/:id")
  atualizar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Conta não encontrada.");
    const pedido = conta.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]?.path[0]));
    return this.executar(() => this.contas.atualizar(this.tenant(tenant), id, pedido.data));
  }

  @Post("contas/transferencias")
  transferir(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = transferencia.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]?.path[0]));
    return this.executar(() => this.contas.transferir(this.tenant(tenant), pedido.data));
  }

  @Get("contas/:id/faturas")
  faturas(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Conta não encontrada.");
    return this.executar(() => this.contas.faturas(this.tenant(tenant), id));
  }

  @Post("contas/:id/pagar-fatura")
  pagarFatura(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Conta não encontrada.");
    const pedido = pagamentoDaFatura.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]?.path[0]));
    return this.executar(() => this.contas.pagarFatura(this.tenant(tenant), id, pedido.data));
  }

  @Post("contas/:id/ajuste")
  ajustar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Conta não encontrada.");
    const pedido = ajuste.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]?.path[0]));
    return this.executar(() => this.contas.ajustarSaldo(this.tenant(tenant), id, pedido.data));
  }

  @Delete("contas/:id")
  @HttpCode(204)
  excluir(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Conta não encontrada.");
    return this.executar(() => this.contas.excluir(this.tenant(tenant), id));
  }

  private mensagem(campo: PropertyKey | undefined) {
    if (campo === "name") return "Dê um nome à conta.";
    if (campo === "openingCents") return "Informe o saldo inicial em centavos.";
    if (campo === "openingOn") return "Informe a data do saldo inicial (AAAA-MM-DD).";
    if (campo === "saldoCents") return "Informe o saldo que o banco mostra, em centavos.";
    if (campo === "closingDay") return "O dia do fechamento vai de 1 a 28.";
    if (campo === "dueDay") return "O dia do vencimento vai de 1 a 28.";
    if (campo === "limitCents") return "Informe o limite do cartão em centavos.";
    if (campo === "fromAccountId") return "Escolha a conta de onde o dinheiro sai.";
    if (campo === "toAccountId") return "Escolha a conta em que o dinheiro entra.";
    if (campo === "cents") return "Informe o valor do pagamento.";
    if (campo === "month") return "Informe a fatura (AAAA-MM).";
    if (campo === "date") return "Informe a data do saldo (AAAA-MM-DD).";
    return "Confira os dados da conta.";
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
