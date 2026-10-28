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
  Put,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../grupos/dominio/erros.js";
import { MetasService } from "./aplicacao/metas.service.js";

const tenantId = z.uuid();
const criarMeta = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(80),
    targetCents: z.number().int().positive().max(2_147_483_647),
    savedCents: z.number().int().min(0).max(2_147_483_647),
    dueYear: z.number().int().min(2000).max(2100).nullable(),
    dueMonth: z.number().int().min(1).max(12).nullable(),
  })
  .superRefine((pedido, contexto) => {
    const informado = pedido.dueYear !== null || pedido.dueMonth !== null;
    if (informado && (pedido.dueYear === null || pedido.dueMonth === null)) {
      contexto.addIssue({ code: "custom", message: "Informe o mês e o ano do prazo." });
    }
  });

const separarMeta = z.object({ cents: z.number().int().positive().max(2_147_483_647) });

const divisaoDasMetas = z
  .object({ percents: z.record(z.uuid(), z.number().int().min(0).max(100)) })
  .refine((pedido) => Object.values(pedido.percents).reduce((soma, valor) => soma + valor, 0) <= 100, {
    message: "A soma das porcentagens passa de 100%.",
  });
const ordemDasMetas = z.object({ ids: z.array(z.uuid()).max(500) });

@Controller("metas")
export class MetasController {
  constructor(private readonly metas: MetasService) {}

  @Get()
  listar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.metas.listar(this.tenant(tenant)));
  }

  @Post()
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = criarMeta.safeParse(body);
    if (!pedido.success) {
      const mensagem = pedido.error.issues[0]?.message;
      if (mensagem && pedido.error.issues[0]?.code === "custom") {
        throw new BadRequestException(mensagem);
      }
      throw new BadRequestException("Não foi possível salvar a meta.");
    }
    return this.executar(() => this.metas.criar(this.tenant(tenant), pedido.data));
  }

  @Put("divisao")
  @HttpCode(204)
  dividir(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = divisaoDasMetas.safeParse(body);
    if (!pedido.success) throw new BadRequestException(pedido.error.issues[0]?.message ?? "Divisão inválida.");
    return this.executar(() => this.metas.dividir(this.tenant(tenant), pedido.data.percents));
  }

  @Post(":id/aprovar")
  @HttpCode(204)
  aprovar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    const metaId = z.uuid().safeParse(id);
    if (!metaId.success) throw new BadRequestException("Meta inválida.");
    return this.executar(() => this.metas.aprovar(this.tenant(tenant), metaId.data));
  }

  @Put("ordem")
  @HttpCode(204)
  reordenar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = ordemDasMetas.safeParse(body);
    if (!pedido.success || new Set(pedido.data.ids).size !== pedido.data.ids.length) {
      throw new BadRequestException("Ordem inválida.");
    }
    return this.executar(() => this.metas.reordenar(this.tenant(tenant), pedido.data.ids));
  }

  @Post(":id/separar")
  @HttpCode(204)
  separar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    const metaId = z.uuid().safeParse(id);
    const pedido = separarMeta.safeParse(body);
    if (!metaId.success || !pedido.success) throw new BadRequestException("Informe um valor em reais.");
    return this.executar(() => this.metas.separar(this.tenant(tenant), metaId.data, pedido.data.cents));
  }

  @Delete(":id")
  @HttpCode(204)
  excluir(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    const metaId = z.uuid().safeParse(id);
    if (!metaId.success) throw new BadRequestException("Meta inválida.");
    return this.executar(() => this.metas.excluir(this.tenant(tenant), metaId.data));
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
      if (error instanceof BancoIndisponivel) {
        throw new ServiceUnavailableException(error.message);
      }
      if (error instanceof Conflito) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
