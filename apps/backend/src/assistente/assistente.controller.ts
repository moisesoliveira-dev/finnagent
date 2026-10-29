import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { EventoDoChat } from "@finnagent/contracts";
import type { Response } from "express";
import { z } from "zod";
import type { PedidoAutenticado } from "../auth/sessao.guard.js";
import { BancoIndisponivel, NaoEncontrado, PedidoInvalido } from "../grupos/dominio/erros.js";
import { AssistenteService } from "./aplicacao/assistente.service.js";
import { AssistenteIndisponivel, SemModelo } from "./dominio/erros.js";

const tenantId = z.uuid();
const idDaConversa = z.uuid();

/** Linha em branco de tempos em tempos: o leitor do NDJSON ignora, e a conexão não parece ociosa. */
const INTERVALO_DO_SINAL_DE_VIDA = 10_000;

@Controller("assistente")
export class AssistenteController {
  private readonly log = new Logger(AssistenteController.name);

  constructor(private readonly assistente: AssistenteService) {}

  @Get("conversas")
  listar(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado) {
    return this.executar(() => this.assistente.listar(this.tenant(tenant), this.usuario(pedido)));
  }

  @Get("conversas/:id")
  obter(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado, @Param("id") id: string) {
    return this.executar(() => this.assistente.obter(this.tenant(tenant), this.usuario(pedido), this.conversa(id)));
  }

  @Post("conversas/:id/parar")
  @HttpCode(204)
  async parar(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado, @Param("id") id: string) {
    await this.executar(() => this.assistente.parar(this.tenant(tenant), this.usuario(pedido), this.conversa(id)));
  }

  @Patch("conversas/:id")
  renomear(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Req() pedido: PedidoAutenticado,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.executar(() => this.assistente.renomear(this.tenant(tenant), this.usuario(pedido), this.conversa(id), body));
  }

  @Delete("conversas/:id")
  @HttpCode(204)
  async remover(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado, @Param("id") id: string) {
    await this.executar(() => this.assistente.remover(this.tenant(tenant), this.usuario(pedido), this.conversa(id)));
  }

  @Delete("conversas")
  @HttpCode(204)
  async removerTodas(@Headers("x-tenant-id") tenant: string | undefined, @Req() pedido: PedidoAutenticado) {
    await this.executar(() => this.assistente.removerTodas(this.tenant(tenant), this.usuario(pedido)));
  }

  /**
   * Um turno de conversa em NDJSON. O cabeçalho só sai no primeiro evento: o que falha antes
   * (pedido, modelo, conversa) responde com o status certo, como qualquer outra rota.
   */
  @Post("mensagens")
  async conversar(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Headers("authorization") autorizacao: string | undefined,
    @Req() pedido: PedidoAutenticado,
    @Res() resposta: Response,
    @Body() body: unknown,
  ) {
    const inicio = Date.now();
    const sinalDeVida = setInterval(() => {
      if (resposta.headersSent && !resposta.writableEnded && !resposta.destroyed) resposta.write("\n");
    }, INTERVALO_DO_SINAL_DE_VIDA);
    resposta.on("close", () => {
      clearInterval(sinalDeVida);
      if (!resposta.writableFinished) {
        this.log.warn(`conexão do chat fechada antes do fim, após ${Date.now() - inicio} ms: o turno segue no servidor`);
      }
    });
    const emitir = (evento: EventoDoChat) => {
      if (!resposta.headersSent) {
        resposta.writeHead(200, {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-store",
          "x-accel-buffering": "no",
        });
      }
      if (!resposta.writableEnded && !resposta.destroyed) resposta.write(`${JSON.stringify(evento)}\n`);
    };
    const token = autorizacao?.startsWith("Bearer ") ? autorizacao.slice(7).trim() : "";
    try {
      await this.executar(() =>
        this.assistente.conversar(
          { tenantId: this.tenant(tenant), userId: this.usuario(pedido), token },
          body,
          emitir,
        ),
      );
      resposta.end();
    } catch (error) {
      if (resposta.headersSent) {
        emitir({ tipo: "erro", message: error instanceof Error ? error.message : "O assistente falhou." });
        resposta.end();
        return;
      }
      const http = error as { getStatus?: () => number; getResponse?: () => unknown };
      const status = http.getStatus?.() ?? 500;
      const corpo = http.getResponse?.() ?? { message: "O assistente falhou." };
      resposta.status(status).json(typeof corpo === "string" ? { message: corpo } : corpo);
    }
  }

  private tenant(value: string | undefined) {
    const parsed = tenantId.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Tenant ausente.");
    return parsed.data;
  }

  private usuario(pedido: PedidoAutenticado) {
    if (!pedido.usuarioId) throw new BadRequestException("Usuário ausente.");
    return pedido.usuarioId;
  }

  private conversa(id: string) {
    const parsed = idDaConversa.safeParse(id);
    if (!parsed.success) throw new NotFoundException("Conversa não encontrada.");
    return parsed.data;
  }

  private async executar<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof BancoIndisponivel) throw new ServiceUnavailableException(error.message);
      if (error instanceof AssistenteIndisponivel) throw new ServiceUnavailableException(error.message);
      if (error instanceof SemModelo) throw new BadRequestException(error.message);
      if (error instanceof PedidoInvalido) throw new BadRequestException(error.message);
      if (error instanceof NaoEncontrado) throw new NotFoundException(error.message || "Conversa não encontrada.");
      throw error;
    }
  }
}
