import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MOVIMENTOS_DA_CAIXINHA } from "@finnagent/contracts";
import { z } from "zod";
import { BancoIndisponivel, Conflito, NaoEncontrado, PedidoInvalido } from "../grupos/dominio/erros.js";
import { CaixinhasService } from "./aplicacao/caixinhas.service.js";

const tenantId = z.uuid();
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const caixinha = z.object({
  name: z.string().trim().min(1).max(60),
  openingCents: z.number().int().min(0).max(2_147_483_647).default(0),
  // Ausente: hoje na criação, a data gravada na edição. null: sem data.
  openingOn: dataIso.nullable().optional(),
  goalId: z.uuid().nullable().default(null),
});
const saldo = z.object({ saldoCents: z.number().int().min(0).max(2_147_483_647), date: dataIso });
const criarCaixinha = caixinha.extend({ id: z.uuid() });
const movimento = z
  .object({
    tipo: z.enum(MOVIMENTOS_DA_CAIXINHA),
    cents: z.number().int().gte(-2_147_483_647).lte(2_147_483_647).refine((valor) => valor !== 0),
    date: dataIso,
  })
  .refine((pedido) => pedido.tipo === "rendimento" || pedido.cents > 0, { path: ["cents"] });

@Controller()
export class CaixinhasController {
  constructor(private readonly caixinhas: CaixinhasService) {}

  @Post("contas/:id/caixinhas")
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") accountId: string, @Body() body: unknown) {
    if (!z.uuid().safeParse(accountId).success) throw new NotFoundException("Conta não encontrada.");
    const pedido = criarCaixinha.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]?.path[0]));
    const { id, ...dados } = pedido.data;
    return this.executar(() => this.caixinhas.criar(this.tenant(tenant), accountId, id, dados));
  }

  @Patch("caixinhas/:id")
  atualizar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Caixinha não encontrada.");
    const pedido = caixinha.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]?.path[0]));
    return this.executar(() => this.caixinhas.atualizar(this.tenant(tenant), id, pedido.data));
  }

  @Delete("caixinhas/:id")
  @HttpCode(204)
  excluir(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Caixinha não encontrada.");
    return this.executar(() => this.caixinhas.excluir(this.tenant(tenant), id));
  }

  @Post("caixinhas/:id/saldo")
  informarSaldo(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Caixinha não encontrada.");
    const pedido = saldo.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]?.path[0]));
    return this.executar(() => this.caixinhas.informarSaldo(this.tenant(tenant), id, pedido.data));
  }

  @Post("caixinhas/:id/movimentos")
  movimentar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Caixinha não encontrada.");
    const pedido = movimento.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]?.path[0]));
    return this.executar(() => this.caixinhas.movimentar(this.tenant(tenant), id, pedido.data));
  }

  private mensagem(campo: PropertyKey | undefined) {
    if (campo === "name") return "Dê um nome à caixinha.";
    if (campo === "openingCents") return "Informe o saldo inicial da caixinha.";
    if (campo === "openingOn") return "Informe a data do saldo inicial (AAAA-MM-DD).";
    if (campo === "saldoCents") return "Informe o saldo que a caixinha mostra, sem sinal.";
    if (campo === "goalId") return "Meta inválida.";
    if (campo === "cents") return "Informe o valor. Aplicação e resgate são positivos; rendimento negativo é perda.";
    if (campo === "date") return "Informe a data.";
    if (campo === "tipo") return "O movimento é rendimento, aplicação ou resgate.";
    return "Confira os dados da caixinha.";
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
      if (error instanceof PedidoInvalido) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
