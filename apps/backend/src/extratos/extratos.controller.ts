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
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  DIFERENCAS_DO_PAGAMENTO,
  ESQUEMA_DO_TIPO_DA_LINHA,
  LIMITE_OBSERVACAO_DO_EXTRATO,
  PAPEIS_DA_LINHA_NA_SERIE,
  type ConferenciaDesfazendo,
  type ConferenciaDesfeita,
} from "@finnagent/contracts";
import type { PedidoAutenticado } from "../auth/sessao.guard.js";
import { FilaDeConferencia } from "./adaptadores/fila-de-conferencia.js";
import { z } from "zod";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../grupos/dominio/erros.js";
import { ExtratosService } from "./aplicacao/extratos.service.js";
import { PARTES_MAXIMAS, PARTES_MINIMAS } from "./dominio/divisao.js";
import { AgenteIndisponivel, PedidoInvalido } from "./dominio/erros.js";
import { PedidoInvalido as PedidoInvalidoDeFinancas } from "../financas/dominio/erros.js";

const tenantId = z.uuid();
const tipoDaLinha = ESQUEMA_DO_TIPO_DA_LINHA.optional();
const escolhaDaSerie = z
  .array(z.object({ statementId: z.uuid(), line: z.number().int().min(1), papel: z.enum(PAPEIS_DA_LINHA_NA_SERIE) }))
  .min(1)
  .max(400);
const mapeamento = z.object({
  date: z.number().int().min(0).max(40),
  description: z.number().int().min(0).max(40),
  amount: z.number().int().min(0).max(40),
});
const arquivo = z.object({
  filename: z.string().trim().min(1).max(180),
  content: z.string().min(1).max(8_000_000),
  mapping: mapeamento.nullable(),
});
const criarExtrato = arquivo
  .extend({
    id: z.uuid(),
    accountId: z.uuid().nullable(),
    accountName: z.string().trim().min(1).max(80).nullable(),
    note: z.string().trim().max(LIMITE_OBSERVACAO_DO_EXTRATO).optional(),
  })
  .superRefine((pedido, contexto) => {
    if (!pedido.accountId && !pedido.accountName) {
      contexto.addIssue({ code: "custom", message: "Escolha a conta.", path: ["accountId"] });
    }
  });

const deAnexo = z.object({
  id: z.uuid(),
  anexoId: z.uuid(),
  accountName: z.string().trim().min(1).max(80),
  observacao: z.string().trim().max(LIMITE_OBSERVACAO_DO_EXTRATO).default(""),
  mapping: mapeamento.nullable().default(null),
});

@Controller()
export class ExtratosController {
  constructor(
    private readonly extratos: ExtratosService,
    private readonly fila: FilaDeConferencia,
  ) {}

  @Get("extratos")
  listar(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.extratos.listar(this.tenant(tenant)));
  }

  @Get("extratos/conferencia")
  conferencia(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Query("year") year: string | undefined,
    @Query("month") month: string | undefined,
    @Query("abrir") abrir: string | undefined,
    @Query("pagina") pagina: string | undefined,
    @Query("busca") busca: string | undefined,
  ) {
    const pedido = z
      .object({
        year: z.coerce.number().int().min(2000).max(2100),
        month: z.coerce.number().int().min(1).max(12),
        abrir: z.enum(["pendente"]).optional(),
        // 0: todas as linhas sem lançamento numa resposta só, até LINHAS_DA_CONFERENCIA_DE_UMA_VEZ.
        pagina: z.coerce.number().int().min(0).max(100).optional(),
        busca: z.string().trim().min(2).max(120).optional(),
      })
      .safeParse({ year, month, abrir, pagina, busca });
    if (!pedido.success) {
      const campo = pedido.error.issues[0]?.path[0];
      if (campo === "busca") throw new BadRequestException("A busca precisa ter de 2 a 120 letras.");
      if (campo === "pagina") throw new BadRequestException("Informe uma página de 0 a 100.");
      throw new BadRequestException("Informe o mês.");
    }
    const { year: ano, month: mes } = pedido.data;
    const tenantId = this.tenant(tenant);
    return this.executar(() =>
      pedido.data.abrir
        ? this.extratos.abrirConferencia(tenantId, ano, mes)
        : this.extratos.conferencia(tenantId, ano, mes, pedido.data.pagina, pedido.data.busca),
    );
  }

  @Post("extratos/cruzamentos")
  cruzar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z
      .object({
        statementId: z.uuid(),
        line: z.number().int().min(1),
        entryId: z.uuid(),
        valor: z.enum(["extrato", "lancamento"]).optional(),
        diferenca: z.enum(DIFERENCAS_DO_PAGAMENTO).optional(),
      })
      .safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha o lançamento desta linha.");
    return this.executar(() =>
      this.extratos.confirmar(
        this.tenant(tenant),
        pedido.data.statementId,
        pedido.data.line,
        pedido.data.entryId,
        pedido.data.valor,
        pedido.data.diferenca,
      ),
    );
  }

  @Post("extratos/cruzamentos/desfazer")
  desfazer(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z.object({ statementId: z.uuid(), line: z.number().int().min(1) }).safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha a linha cruzada.");
    return this.executar(() => this.extratos.desfazer(this.tenant(tenant), pedido.data.statementId, pedido.data.line));
  }

  @Post("extratos/acumular-lote")
  acumularLote(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z
      .object({
        items: z
          .array(
            z.object({
              statementId: z.uuid(),
              line: z.number().int().min(1),
              sessionId: z.uuid(),
              valor: z.enum(["extrato", "lancamento"]).optional(),
              emPartes: z.boolean().optional(),
              nome: z.string().trim().min(1).max(160).optional(),
              tipo: tipoDaLinha,
            }),
          )
          .min(1)
          .max(500),
      })
      .safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha as linhas e a sessão para lançar.");
    return this.executar(() => this.extratos.acumularVarias(this.tenant(tenant), pedido.data.items));
  }

  /** As linhas de outros meses que são a mesma compra da linha que vai virar parcela, empréstimo ou recorrente. */
  @Post("extratos/series/previa")
  @HttpCode(200)
  previaDaSerie(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z.object({ statementId: z.uuid(), line: z.number().int().min(1), tipo: ESQUEMA_DO_TIPO_DA_LINHA }).safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha a linha e o tipo.");
    return this.executar(() => this.extratos.previaDaSerie(this.tenant(tenant), pedido.data.statementId, pedido.data.line, pedido.data.tipo));
  }

  /** Cria a série com as linhas escolhidas de vários meses. */
  @Post("extratos/series")
  lancarSerie(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z
      .object({
        statementId: z.uuid(),
        line: z.number().int().min(1),
        sessionId: z.uuid(),
        tipo: ESQUEMA_DO_TIPO_DA_LINHA,
        nome: z.string().trim().min(1).max(160).optional(),
        linhas: escolhaDaSerie,
      })
      .safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha a sessão, o tipo e as linhas da série.");
    const { statementId, line, sessionId, tipo, nome, linhas } = pedido.data;
    return this.executar(() => this.extratos.lancarSerie(this.tenant(tenant), { statementId, line }, sessionId, tipo, linhas, nome));
  }

  /** As parcelas, empréstimos e recorrentes que já existem e têm linhas livres em outros meses importados. */
  @Get("extratos/series")
  seriesComLinhas(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.executar(() => this.extratos.seriesComLinhas(this.tenant(tenant)));
  }

  /** Junta à série que já existe as linhas escolhidas de outros meses. */
  @Post("extratos/series/:id/linhas")
  juntarASerie(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string, @Body() body: unknown) {
    const entryId = z.uuid().safeParse(id);
    const pedido = z.object({ linhas: escolhaDaSerie }).safeParse(body);
    if (!entryId.success) throw new BadRequestException("Lançamento não encontrado.");
    if (!pedido.success) throw new BadRequestException("Escolha as linhas da série.");
    return this.executar(() => this.extratos.juntarASerie(this.tenant(tenant), entryId.data, pedido.data.linhas));
  }

  @Post("extratos/dividir")
  dividir(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z
      .object({
        statementId: z.uuid(),
        line: z.number().int().min(1),
        parts: z
          .array(
            z.object({
              cents: z.number().int().refine((valor) => valor !== 0),
              sessionId: z.uuid(),
              nome: z.string().trim().min(1).max(160).optional(),
              tipo: tipoDaLinha,
            }),
          )
          .min(PARTES_MINIMAS)
          .max(PARTES_MAXIMAS),
      })
      .safeParse(body);
    if (!pedido.success) {
      throw new BadRequestException(`Divida a linha em ${PARTES_MINIMAS} a ${PARTES_MAXIMAS} partes, cada uma com valor e sessão.`);
    }
    const { statementId, line, parts } = pedido.data;
    return this.executar(() => this.extratos.dividir(this.tenant(tenant), statementId, line, parts));
  }

  @Post("extratos/ignorar")
  ignorar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z
      .object({
        items: z.array(z.object({ statementId: z.uuid(), line: z.number().int().min(1) })).min(1).max(500),
        ignored: z.boolean(),
      })
      .safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha as linhas para ignorar ou reativar.");
    return this.executar(() => this.extratos.ignorar(this.tenant(tenant), pedido.data.items, pedido.data.ignored));
  }

  @Post("extratos/transferir")
  transferir(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z.object({ statementId: z.uuid(), line: z.number().int().min(1), accountId: z.uuid() }).safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha a linha e a outra conta da transferência.");
    return this.executar(() => this.extratos.transferirLinha(this.tenant(tenant), pedido.data.statementId, pedido.data.line, pedido.data.accountId));
  }

  @Post("extratos/acumular")
  acumular(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = z
      .object({
        statementId: z.uuid(),
        line: z.number().int().min(1),
        sessionId: z.uuid(),
        valor: z.enum(["extrato", "lancamento"]).optional(),
        emPartes: z.boolean().optional(),
        nome: z.string().trim().min(1).max(160).optional(),
        tipo: tipoDaLinha,
      })
      .safeParse(body);
    if (!pedido.success) throw new BadRequestException("Escolha a sessão para acumular a linha.");
    return this.executar(() =>
      this.extratos.acumular(this.tenant(tenant), pedido.data.statementId, pedido.data.line, pedido.data.sessionId, {
        ...(pedido.data.valor ? { valor: pedido.data.valor } : {}),
        ...(pedido.data.emPartes ? { emPartes: true } : {}),
        ...(pedido.data.nome ? { nome: pedido.data.nome } : {}),
        ...(pedido.data.tipo ? { tipo: pedido.data.tipo } : {}),
      }),
    );
  }

  @Post("extratos/previa")
  previa(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    this.tenant(tenant);
    const pedido = arquivo.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]));
    return this.executar(() =>
      this.extratos.previa(this.tenant(tenant), pedido.data.filename, pedido.data.content, pedido.data.mapping),
    );
  }

  @Post("extratos")
  criar(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = criarExtrato.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]));
    return this.executar(() => this.extratos.criar(this.tenant(tenant), pedido.data));
  }

  @Post("extratos/de-anexo")
  criarDeAnexo(@Headers("x-tenant-id") tenant: string | undefined, @Body() body: unknown) {
    const pedido = deAnexo.safeParse(body);
    if (!pedido.success) throw new BadRequestException(this.mensagem(pedido.error.issues[0]));
    return this.executar(() => this.extratos.criarDeAnexo(this.tenant(tenant), pedido.data));
  }

  @Get("extratos/:id/linhas")
  linhas(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id") id: string,
    @Query("erros") erros: string | undefined,
  ) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException("Extrato não encontrado.");
    return this.executar(() => this.extratos.linhas(this.tenant(tenant), id, erros === "1"));
  }

  /**
   * Desfazer tudo leva segundos por linha, então vai para a fila: a resposta diz que começou (`queued`) e a
   * central avisa quando termina. Sem fila (sem Redis), faz na hora e devolve a contagem. Um por conta de cada vez.
   */
  @Post("extratos/conferencia/desfazer-tudo")
  @HttpCode(200)
  desfazerConferencia(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Req() pedido: PedidoAutenticado,
  ): Promise<ConferenciaDesfazendo | ConferenciaDesfeita> {
    const tenantId = this.tenant(tenant);
    const userId = pedido.usuarioId ?? null;
    return this.executar(async () => {
      const situacao = await this.fila.desfazerConferencia({ tenantId, userId });
      if (situacao === "enfileirado") return { queued: true as const };
      if (situacao === "ja-rodando") {
        throw new ConflictException("A conferência já está sendo desfeita. Você recebe uma notificação quando terminar.");
      }
      return this.extratos.desfazerConferencia(tenantId, userId);
    });
  }

  @Post("extratos/:id/reprocessar")
  reprocessar(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException("Extrato não encontrado.");
    return this.executar(() => this.extratos.reprocessar(this.tenant(tenant), id));
  }

  @Delete("extratos/:id")
  @HttpCode(204)
  excluir(@Headers("x-tenant-id") tenant: string | undefined, @Param("id") id: string) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException("Extrato não encontrado.");
    return this.executar(async () => {
      await this.extratos.excluir(this.tenant(tenant), id);
    });
  }

  private mensagem(issue: { path: PropertyKey[]; message: string; code: string } | undefined) {
    const campo = issue?.path[0];
    if (campo === "accountId" || campo === "accountName") return "Escolha a conta.";
    if (campo === "filename") return "Envie um OFX, um CSV ou uma imagem do extrato.";
    if (campo === "mapping") return "Indique as colunas do CSV.";
    if (issue?.code === "custom" && issue.message) return issue.message;
    return "Não foi possível importar o extrato.";
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
      if (error instanceof BancoIndisponivel || error instanceof AgenteIndisponivel) {
        throw new ServiceUnavailableException(error.message);
      }
      // A Conferência lança pela slice de finanças: a recusa dela também é um pedido inválido, não um 500.
      if (error instanceof PedidoInvalido || error instanceof PedidoInvalidoDeFinancas) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof Conflito) throw new ConflictException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
