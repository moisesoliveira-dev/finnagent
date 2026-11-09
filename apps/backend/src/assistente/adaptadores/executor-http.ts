import { Injectable } from "@nestjs/common";
import { FERRAMENTAS_POR_NOME, type ChamadaDeFerramenta } from "@finnagent/contracts";
import { log } from "../../log.js";
import { resultadoParaOModelo } from "../dominio/conversa.js";
import type { Credencial, ExecutorDeFerramentas, ResultadoDaExecucao } from "../portas/executor-de-ferramentas.js";
import { ROTAS_DAS_FERRAMENTAS, montarUrl } from "./rotas-das-ferramentas.js";

const PRAZO = 60_000;

// Cada linha do extrato custa vários acessos ao banco. Um lote grande num pedido só passa do prazo: vai em blocos.
const LINHAS_POR_PEDIDO = 8;

type Lote = {
  launched: number;
  failed: { statementId: string; line: number; message: string }[];
  remaining: { year: number; month: number; lines: number }[];
};

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
    const url = montarUrl(this.base, rota, args.data);
    const itens = chamada.nome === "acumular_linhas" ? itensDoLote(corpo) : null;
    if (itens && itens.length > LINHAS_POR_PEDIDO) return this.emBlocos(url, rota.metodo, credencial, itens);

    const resposta = await this.pedir(url, rota.metodo, credencial, corpo, chamada.nome);
    if (!resposta) return falha("O sistema não respondeu a tempo.", "O sistema não respondeu a tempo.");

    if (resposta.status === 204) return { ok: true, conteudo: "Feito.", detalhe: "" };
    const texto = await resposta.text();
    let lido: unknown = texto;
    try {
      lido = texto ? JSON.parse(texto) : null;
    } catch {
      // Resposta em texto puro: o modelo lê como veio.
    }
    if (resposta.ok && itens) return resultadoDoLote(lido as Partial<Lote> | null);
    if (resposta.ok) return { ok: true, conteudo: resultadoParaOModelo(lido, chamada.nome), detalhe: "" };
    const mensagem =
      lido && typeof lido === "object" && "message" in lido ? String((lido as { message: unknown }).message) : `Erro ${resposta.status}.`;
    return falha(`Erro ${resposta.status}: ${mensagem}`, mensagem);
  }

  private async pedir(url: string | URL, metodo: string, credencial: Credencial, corpo: unknown, ferramenta: string) {
    try {
      return await fetch(url, {
        method: metodo,
        headers: {
          "content-type": "application/json",
          ...(credencial.token ? { authorization: `Bearer ${credencial.token}` } : {}),
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(PRAZO),
      });
    } catch (error) {
      log.error(
        { ferramenta, err: error instanceof Error ? error.message : String(error) },
        "a ferramenta não obteve resposta da própria API",
      );
      return null;
    }
  }

  /** O lote do plano em pedidos de poucas linhas, somados num resultado só, do mesmo formato do lote inteiro. */
  private async emBlocos(url: string | URL, metodo: string, credencial: Credencial, itens: unknown[]): Promise<ResultadoDaExecucao> {
    const total: Lote = { launched: 0, failed: [], remaining: [] };
    const meses = new Map<string, Lote["remaining"][number]>();
    for (let inicio = 0; inicio < itens.length; inicio += LINHAS_POR_PEDIDO) {
      const bloco = itens.slice(inicio, inicio + LINHAS_POR_PEDIDO);
      const resposta = await this.pedir(url, metodo, credencial, { items: bloco }, "acumular_linhas");
      const lido = resposta?.ok ? ((await resposta.json().catch(() => null)) as Partial<Lote> | null) : null;
      if (!resposta || !lido) {
        const corpo = resposta ? ((await resposta.json().catch(() => null)) as { message?: unknown } | null) : null;
        const message = corpo && typeof corpo.message === "string" ? corpo.message : "O sistema não respondeu a tempo.";
        total.failed.push(...bloco.map((item) => ({ ...linhaDe(item), message })));
        continue;
      }
      total.launched += lido.launched ?? 0;
      total.failed.push(...(lido.failed ?? []));
      // A contagem mais nova de cada mês é a que vale: o bloco seguinte já vê o que o anterior lançou.
      for (const mes of lido.remaining ?? []) meses.set(`${mes.year}-${mes.month}`, mes);
    }
    total.remaining = [...meses.values()];
    return resultadoDoLote(total);
  }
}

/**
 * O lote responde 201 mesmo quando linhas falham. Nenhuma lançada é falha do passo; parte lançada é feito com a
 * ressalva no cartão. O conteúdo vai inteiro para o modelo: launched, failed (com o motivo) e remaining.
 */
function resultadoDoLote(lido: Partial<Lote> | null): ResultadoDaExecucao {
  const launched = lido?.launched ?? 0;
  const failed = lido?.failed ?? [];
  const conteudo = resultadoParaOModelo(lido);
  if (failed.length && launched === 0) {
    return { ok: false, conteudo: `Nenhuma linha foi lançada. ${conteudo}`, detalhe: `Nenhuma linha entrou: ${motivosDe(failed)}` };
  }
  if (failed.length) {
    return { ok: true, conteudo, detalhe: `${launched} lançada(s), ${failed.length} não: ${motivosDe(failed)}` };
  }
  return { ok: true, conteudo, detalhe: "" };
}

function motivosDe(failed: Lote["failed"]) {
  const motivos = [...new Set(failed.map((item) => item.message))];
  const texto = motivos.slice(0, 3).join(" ");
  return motivos.length > 3 ? `${texto} (e mais ${motivos.length - 3})` : texto;
}

function itensDoLote(corpo: unknown) {
  if (!corpo || typeof corpo !== "object") return null;
  const itens = (corpo as { items?: unknown }).items;
  return Array.isArray(itens) ? itens : null;
}

function linhaDe(item: unknown) {
  const linha = (item ?? {}) as { statementId?: unknown; line?: unknown };
  return { statementId: typeof linha.statementId === "string" ? linha.statementId : "", line: Number(linha.line ?? 0) };
}

function falha(conteudo: string, detalhe = conteudo): ResultadoDaExecucao {
  return { ok: false, conteudo, detalhe };
}
