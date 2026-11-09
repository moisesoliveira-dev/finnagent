import {
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { PedidoInvalido as PedidoInvalidoDeFinancas } from "../financas/dominio/erros.js";
import { BancoIndisponivel, Conflito, NaoEncontrado, PedidoInvalido } from "../grupos/dominio/erros.js";
import { ExclusoesService } from "./aplicacao/exclusoes.service.js";

const tenantId = z.uuid();

/** As rotas de apagar que dependem do estado de mais de uma fatia. Os caminhos são os de sempre. */
@Controller()
export class ExclusoesController {
  constructor(private readonly exclusoes: ExclusoesService) {}

  @Delete("lancamentos/:id")
  @HttpCode(204)
  lancamento(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    return this.executar(() => this.exclusoes.lancamento(this.tenant(tenant), this.id(id, "Lançamento não encontrado.")));
  }

  @Delete("lancamentos/:id/ocorrencias/:numero")
  ocorrencia(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Param("numero") numero: string,
  ) {
    const number = Number(numero);
    if (!Number.isInteger(number) || number < 1 || number > 3660) {
      throw new BadRequestException("Não foi possível apagar este mês.");
    }
    return this.executar(() =>
      this.exclusoes.ocorrencia(this.tenant(tenant), this.id(id, "Lançamento não encontrado."), number),
    );
  }

  @Delete("sessoes/:id")
  @HttpCode(204)
  sessao(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    return this.executar(() => this.exclusoes.sessao(this.tenant(tenant), this.id(id, "Sessão não encontrada.")));
  }

  @Delete("metas/:id")
  @HttpCode(204)
  meta(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    return this.executar(() => this.exclusoes.meta(this.tenant(tenant), this.id(id, "Meta inválida.")));
  }

  @Delete("grupos/:id")
  @HttpCode(204)
  grupo(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    return this.executar(() => this.exclusoes.grupo(this.tenant(tenant), this.id(id, "Grupo não encontrado.")));
  }

  private tenant(value: string | undefined) {
    const parsed = tenantId.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Tenant ausente.");
    return parsed.data;
  }

  private id(value: string, mensagem: string) {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) throw new BadRequestException(mensagem);
    return parsed.data;
  }

  private async executar<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof BancoIndisponivel) throw new ServiceUnavailableException(error.message);
      if (error instanceof Conflito) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      if (error instanceof PedidoInvalido || error instanceof PedidoInvalidoDeFinancas) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
