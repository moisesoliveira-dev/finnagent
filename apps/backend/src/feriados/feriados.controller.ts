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
import { FinancasService } from "../financas/aplicacao/financas.service.js";
import { BancoIndisponivel, Conflito, NaoEncontrado, PedidoInvalido } from "../grupos/dominio/erros.js";
import { FeriadosService } from "./aplicacao/feriados.service.js";

const tenantId = z.uuid();
const ano = z.coerce.number().int().min(2000).max(2100);

/**
 * Feriados do ano e os locais da conta. Cadastrar ou tirar um feriado local muda o que é dia útil:
 * depois de gravar, os vencimentos pendentes de quem tem regra são recalculados.
 */
@Controller("feriados")
export class FeriadosController {
  constructor(
    private readonly feriados: FeriadosService,
    private readonly financas: FinancasService,
  ) {}

  @Get()
  listar(@Headers("x-tenant-id") tenant: string | undefined, @Query("year") year: string | undefined) {
    const lido = ano.safeParse(year ?? new Date().getUTCFullYear());
    if (!lido.success) throw new BadRequestException("Informe o ano.");
    return this.executar(() => this.feriados.doAno(this.tenant(tenant), lido.data));
  }

  @Post()
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    return this.executar(async () => {
      const id = this.tenant(tenant);
      const feriado = await this.feriados.adicionar(id, body);
      return { feriado, redatados: await this.financas.redatarVencimentos(id) };
    });
  }

  @Delete(":id")
  @HttpCode(200)
  remover(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException("Feriado não encontrado.");
    return this.executar(async () => {
      const conta = this.tenant(tenant);
      await this.feriados.remover(conta, id);
      return { redatados: await this.financas.redatarVencimentos(conta) };
    });
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
