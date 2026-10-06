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
import { GruposService } from "./aplicacao/grupos.service.js";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "./dominio/erros.js";

const tenantId = z.uuid();
const nome = z.string().trim().min(1).max(80);
const criarGrupo = z.object({ id: z.uuid(), name: nome });
const criarSessao = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  name: nome,
  cents: z.number().int().gte(-2_147_483_648).lte(2_147_483_647),
});

@Controller()
export class GruposController {
  constructor(private readonly grupos: GruposService) {}

  @Get("grupos")
  listar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.grupos.listar(this.tenant(tenant)));
  }

  @Post("grupos")
  criarGrupo(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Body() body: unknown,
  ) {
    const pedido = this.pedido(criarGrupo, body, "Dê um nome ao grupo.");
    return this.executar(() =>
      this.grupos.criarGrupo(this.tenant(tenant), pedido.id, pedido.name),
    );
  }

  @Delete("grupos/:id")
  @HttpCode(204)
  removerGrupo(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
  ) {
    return this.executar(() =>
      this.grupos.removerGrupo(this.tenant(tenant), this.id(id)),
    );
  }

  @Post("sessoes")
  criarSessao(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Body() body: unknown,
  ) {
    const pedido = this.pedidoSessao(body);
    return this.executar(() =>
      this.grupos.criarSessao(
        this.tenant(tenant),
        pedido.id,
        pedido.groupId,
        pedido.name,
        pedido.cents,
      ),
    );
  }

  @Delete("sessoes/:id")
  @HttpCode(204)
  removerSessao(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
  ) {
    return this.executar(() =>
      this.grupos.removerSessao(this.tenant(tenant), this.id(id)),
    );
  }

  private tenant(value: string | undefined) {
    const parsed = tenantId.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Tenant ausente.");
    return parsed.data;
  }

  private id(value: string) {
    const parsed = tenantId.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Identificador inválido.");
    return parsed.data;
  }

  private pedidoSessao(body: unknown) {
    const parsed = criarSessao.safeParse(body);
    if (!parsed.success) {
      const campo = parsed.error.issues[0]?.path[0];
      if (campo === "name") throw new BadRequestException("Dê um nome à sessão.");
      if (campo === "cents") throw new BadRequestException("Informe o valor da sessão.");
      throw new BadRequestException("Não foi possível criar a sessão.");
    }
    return parsed.data;
  }

  private pedido<T>(schema: z.ZodType<T>, body: unknown, message: string): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(message);
    return parsed.data;
  }

  private async executar<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof BancoIndisponivel) {
        throw new ServiceUnavailableException(error.message);
      }
      if (error instanceof Conflito) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
