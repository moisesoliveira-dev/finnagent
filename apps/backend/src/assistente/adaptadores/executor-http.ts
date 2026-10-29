import { Injectable } from "@nestjs/common";
import { FERRAMENTAS_POR_NOME, type ChamadaDeFerramenta } from "@finnagent/contracts";
import { log } from "../../log.js";
import { resultadoParaOModelo } from "../dominio/conversa.js";
import type { Credencial, ExecutorDeFerramentas, ResultadoDaExecucao } from "../portas/executor-de-ferramentas.js";
import { ROTAS_DAS_FERRAMENTAS, montarUrl } from "./rotas-das-ferramentas.js";

const PRAZO = 60_000;

/**
 * Executa a ferramenta chamando a própria API, com o token de quem conversa. A ação passa pelo mesmo
 * guarda, pela mesma validação e grava os mesmos eventos que a tela: a IA age como a pessoa agiria.
 */
@Injectable()
export class ExecutorHttp implements ExecutorDeFerramentas {
  private get base() {
    return `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  }

  async executar(chamada: ChamadaDeFerramenta, credencial: Credencial): Promise<ResultadoDaExecucao> {
    const ferramenta = FERRAMENTAS_POR_NOME.get(chamada.nome);
    const rota = ROTAS_DAS_FERRAMENTAS[chamada.nome];
    if (!ferramenta || !rota) return falha("Ferramenta desconhecida. Use só as ferramentas oferecidas.");

    const args = ferramenta.esquema.safeParse(chamada.args);
    if (!args.success) {
      const problemas = args.error.issues
        .slice(0, 5)
        .map((item) => `${item.path.join(".") || "campo"}: ${item.message}`)
        .join("; ");
      return falha(`Argumentos inválidos (${problemas}). Corrija e tente de novo.`, "Os dados enviados estavam incompletos.");
    }

    const corpo = rota.corpo?.(args.data, credencial.fuso, chamada.idGerado);
    let resposta: Response;
    try {
      resposta = await fetch(montarUrl(this.base, rota, args.data), {
        method: rota.metodo,
        headers: {
          "content-type": "application/json",
          ...(credencial.token ? { authorization: `Bearer ${credencial.token}` } : {}),
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(PRAZO),
      });
    } catch (error) {
      log.error(
        { ferramenta: chamada.nome, err: error instanceof Error ? error.message : String(error) },
        "a ferramenta não obteve resposta da própria API",
      );
      return falha("O sistema não respondeu a tempo.", "O sistema não respondeu a tempo.");
    }

    if (resposta.status === 204) return { ok: true, conteudo: "Feito.", detalhe: "" };
    const texto = await resposta.text();
    let lido: unknown = texto;
    try {
      lido = texto ? JSON.parse(texto) : null;
    } catch {
      // Resposta em texto puro: o modelo lê como veio.
    }
    if (resposta.ok) return { ok: true, conteudo: resultadoParaOModelo(lido), detalhe: "" };
    const mensagem =
      lido && typeof lido === "object" && "message" in lido ? String((lido as { message: unknown }).message) : `Erro ${resposta.status}.`;
    return falha(`Erro ${resposta.status}: ${mensagem}`, mensagem);
  }
}

function falha(conteudo: string, detalhe = conteudo): ResultadoDaExecucao {
  return { ok: false, conteudo, detalhe };
}
