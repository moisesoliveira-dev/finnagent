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
const conta = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(TIPOS_DE_CONTA).default("conta"),
  openingCents: z.number().int().gte(-2_147_483_647).lte(2_147_483_647).default(0),
});
const criarConta = conta.extend({ id: z.uuid() });

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

  @Delete("contas/:id")
  @HttpCode(204)
  excluir(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Conta não encontrada.");
    return this.executar(() => this.contas.excluir(this.tenant(tenant), id));
  }

  private mensagem(campo: PropertyKey | undefined) {
    if (campo === "name") return "Dê um nome à conta.";
    if (campo === "openingCents") return "Informe o saldo inicial em centavos.";
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
