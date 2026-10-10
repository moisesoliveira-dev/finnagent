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
import { z } from "zod";
import { GruposService } from "./aplicacao/grupos.service.js";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "./dominio/erros.js";

const tenantId = z.uuid();
const nome = z.string().trim().min(1).max(80);
const descricao = z.string().trim().max(160);
const centavos = z.number().int().gte(-2_147_483_648).lte(2_147_483_647);
const criarGrupo = z.object({
  id: z.uuid(),
  name: nome,
  description: descricao.optional().default(""),
});
const atualizarGrupo = z.object({ name: nome, description: descricao });
const justificativa = z.string().trim().max(160);
const criarSessao = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  name: nome,
  description: descricao.optional().default(""),
  justification: justificativa.optional().default(""),
  cents: centavos.optional().default(0),
});
const atualizarSessao = z.object({
  name: nome,
  description: descricao,
  justification: justificativa,
  groupId: z.uuid(),
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
    const pedido = this.pedidoGrupo(criarGrupo, body);
    return this.executar(() =>
      this.grupos.criarGrupo(
        this.tenant(tenant),
        pedido.id,
        pedido.name,
        pedido.description,
      ),
    );
  }

  @Patch("grupos/:id")
  atualizarGrupo(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const pedido = this.pedidoGrupo(atualizarGrupo, body);
    return this.executar(() =>
      this.grupos.atualizarGrupo(
        this.tenant(tenant),
        this.id(id),
        pedido.name,
        pedido.description,
      ),
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
    const pedido = this.pedidoSessao(criarSessao, body);
    return this.executar(() =>
      this.grupos.criarSessao(
        this.tenant(tenant),
        pedido.id,
        {
          groupId: pedido.groupId,
          name: pedido.name,
          description: pedido.description,
          justification: pedido.justification,
        },
        pedido.cents,
      ),
    );
  }

  @Patch("sessoes/:id")
  atualizarSessao(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const pedido = this.pedidoSessao(atualizarSessao, body);
    return this.executar(() =>
      this.grupos.atualizarSessao(this.tenant(tenant), this.id(id), {
        groupId: pedido.groupId,
        name: pedido.name,
        description: pedido.description,
        justification: pedido.justification,
      }),
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

  private pedidoGrupo<T>(schema: z.ZodType<T>, body: unknown): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const campo = parsed.error.issues[0]?.path[0];
      if (campo === "description") {
        throw new BadRequestException("A descrição passa de 160 caracteres.");
      }
      throw new BadRequestException("Dê um nome ao grupo.");
    }
    return parsed.data;
  }

  private pedidoSessao<T>(schema: z.ZodType<T>, body: unknown): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const campo = parsed.error.issues[0]?.path[0];
      if (campo === "name") throw new BadRequestException("Dê um nome à sessão.");
      if (campo === "groupId") throw new BadRequestException("Escolha um grupo.");
      if (campo === "description") {
        throw new BadRequestException("A descrição passa de 160 caracteres.");
      }
      if (campo === "justification") {
        throw new BadRequestException("A justificativa passa de 160 caracteres.");
      }
      if (campo === "cents") throw new BadRequestException("Informe o valor da sessão.");
      throw new BadRequestException("Não foi possível salvar a sessão.");
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
