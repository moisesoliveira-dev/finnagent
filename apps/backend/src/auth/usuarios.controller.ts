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
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { BancoIndisponivel, NaoEncontrado, PedidoInvalido } from "../grupos/dominio/erros.js";
import { AuthService } from "./aplicacao/auth.service.js";
import { EmailEmUso, MasterIntocavel } from "./dominio/erros.js";
import { SoMaster } from "./papel.js";

const tenantId = z.uuid();
const idDoUsuario = z.uuid();

/** Usuários da própria conta. Só o master lista, cria e remove. */
@SoMaster()
@Controller("usuarios")
export class UsuariosController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  listar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.auth.listarUsuarios(this.tenant(tenant)));
  }

  @Post()
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    return this.executar(() => this.auth.criarMembro(this.tenant(tenant), body));
  }

  @Delete(":id")
  @HttpCode(204)
  async remover(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    const alvo = idDoUsuario.safeParse(id);
    if (!alvo.success) throw new BadRequestException("Usuário inválido.");
    await this.executar(() => this.auth.removerUsuario(this.tenant(tenant), alvo.data));
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
      if (error instanceof EmailEmUso || error instanceof MasterIntocavel) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException("Usuário não encontrado.");
      throw error;
    }
  }
}
