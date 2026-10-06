import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { TIPOS_LANCAMENTO } from "@finnagent/contracts";
import { z } from "zod";
import { FinancasService } from "./aplicacao/financas.service.js";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../grupos/dominio/erros.js";

const tenantId = z.uuid();
const texto = z.string().trim().min(1).max(160);
const criarLancamento = z
  .object({
    id: z.uuid(),
    sessionId: z.uuid(),
    type: z.enum(TIPOS_LANCAMENTO),
    description: texto,
    justification: texto,
    day: z.number().int().min(1).max(31),
    cents: z.number().int().gte(-2_147_483_648).lte(2_147_483_647),
    startYear: z.number().int().min(2000).max(2100),
    startMonth: z.number().int().min(1).max(12),
    installments: z.number().int().min(1).max(360).nullable(),
  })
  .superRefine((pedido, contexto) => {
    const parcelado = pedido.type === "parcela" || pedido.type === "empréstimo";
    if (parcelado && pedido.installments == null) {
      contexto.addIssue({ code: "custom", path: ["installments"] });
    }
    if (!parcelado && pedido.installments != null) {
      contexto.addIssue({ code: "custom", path: ["installments"] });
    }
    if (pedido.cents === 0) {
      contexto.addIssue({ code: "custom", path: ["cents"] });
    }
  });

@Controller()
export class FinancasController {
  constructor(private readonly financas: FinancasService) {}

  @Get("financas")
  listar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.financas.listar(this.tenant(tenant)));
  }

  @Post("lancamentos")
  criar(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Body() body: unknown,
  ) {
    const pedido = this.pedido(body);
    return this.executar(() => this.financas.criar(this.tenant(tenant), pedido));
  }

  private tenant(value: string | undefined) {
    const parsed = tenantId.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Tenant ausente.");
    return parsed.data;
  }

  private pedido(body: unknown) {
    const parsed = criarLancamento.safeParse(body);
    if (!parsed.success) {
      const campo = parsed.error.issues[0]?.path[0];
      if (campo === "sessionId") throw new BadRequestException("Escolha uma sessão.");
      if (campo === "description") throw new BadRequestException("Dê uma descrição ao lançamento.");
      if (campo === "justification") {
        throw new BadRequestException("Informe a justificativa.");
      }
      if (campo === "day") throw new BadRequestException("Informe o dia do mês.");
      if (campo === "cents") throw new BadRequestException("Informe o valor.");
      if (campo === "installments") throw new BadRequestException("Informe o número de parcelas.");
      throw new BadRequestException("Não foi possível salvar o lançamento.");
    }
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
