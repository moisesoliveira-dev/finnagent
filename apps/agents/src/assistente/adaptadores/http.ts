import type { IncomingMessage, ServerResponse } from "node:http";
import {
  AGENTES_IA,
  ESPECIALISTAS_IA,
  LIMITE_ID_MODELO,
  LIMITE_INSTRUCOES_IA,
  PROVEDORES_IA,
  type EventoDoPasso,
  type PedidoDePasso,
} from "@finnagent/contracts";
import { z } from "zod";
import { log } from "../../log.js";
import { mensagemDaFalha } from "../dominio/erros.js";
import { erroDaUrl } from "../dominio/url.js";
import { testarProvedor } from "./catalogo-de-modelos.js";
import type { criarGrafoDoAssistente } from "./grafo-do-assistente.js";

const LIMITE_DO_CORPO = 2_000_000;
/** Linha em branco de tempos em tempos: o leitor do NDJSON ignora, e a conexão não parece ociosa. */
const INTERVALO_DO_SINAL_DE_VIDA = 10_000;

const modeloResolvido = z.object({
  kind: z.enum(PROVEDORES_IA),
  apiKey: z.string().max(400),
  baseUrl: z.string().max(300),
  model: z.string().trim().min(1).max(LIMITE_ID_MODELO),
});

const chamada = z.object({
  id: z.string().min(1).max(200),
  nome: z.string().min(1).max(80),
  args: z.record(z.string(), z.unknown()),
});

const mensagem = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().max(20_000) }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().max(40_000),
    agente: z.enum(AGENTES_IA).nullable(),
    toolCalls: z.array(chamada).max(20).optional(),
  }),
  z.object({
    role: z.literal("tool"),
    content: z.string().max(40_000),
    toolCallId: z.string().min(1).max(200),
    nome: z.string().min(1).max(80),
    agente: z.enum(AGENTES_IA).nullable(),
  }),
]);

const pedidoDePasso = z.object({
  modelos: z.partialRecord(z.enum(AGENTES_IA), modeloResolvido),
  temperatura: z.number().min(0).max(2),
  instrucoes: z.string().max(LIMITE_INSTRUCOES_IA),
  contexto: z.object({ hoje: z.string().max(80), usuario: z.string().max(120), fuso: z.string().max(80) }),
  mensagens: z.array(mensagem).min(1).max(300),
  agenteAtivo: z.enum(ESPECIALISTAS_IA).nullable(),
});

const pedidoDeTeste = z.object({
  kind: z.enum(PROVEDORES_IA),
  apiKey: z.string().max(400),
  baseUrl: z.string().max(300),
  model: z.string().max(LIMITE_ID_MODELO),
});

type Assistente = ReturnType<typeof criarGrafoDoAssistente>;

/** Um passo do assistente, em NDJSON: o texto vai saindo à medida que o modelo escreve. */
export function tratarPasso(assistente: Assistente) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    let pedido: PedidoDePasso;
    try {
      const lido = pedidoDePasso.safeParse(JSON.parse(await lerCorpo(req)));
      if (!lido.success) {
        enviar(res, 400, { message: "Pedido inválido para o assistente." });
        return;
      }
      pedido = lido.data as PedidoDePasso;
    } catch {
      enviar(res, 400, { message: "Pedido inválido para o assistente." });
      return;
    }
    const erroDeUrl = Object.values(pedido.modelos)
      .map((modelo) => (modelo && modelo.kind !== "openai" ? erroDaUrl(modelo.baseUrl) : null))
      .find(Boolean);
    if (erroDeUrl) {
      enviar(res, 400, { message: erroDeUrl });
      return;
    }

    const parar = new AbortController();
    let terminou = false;
    const inicio = Date.now();
    log.info(
      {
        mensagens: pedido.mensagens.length,
        agenteAtivo: pedido.agenteAtivo,
        modelos: Object.fromEntries(Object.entries(pedido.modelos).map(([agente, modelo]) => [agente, `${modelo.kind}:${modelo.model}`])),
      },
      "passo recebido",
    );
    res.on("close", () => {
      if (!terminou) {
        log.warn({ ms: Date.now() - inicio }, "conexão do passo fechada antes do fim: o passo foi interrompido");
        parar.abort();
      }
    });
    res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" });
    const sinalDeVida = setInterval(() => {
      if (!res.writableEnded) res.write("\n");
    }, INTERVALO_DO_SINAL_DE_VIDA);
    const emitir = (evento: EventoDoPasso) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(evento)}\n`);
    };
    try {
      const final = await assistente.passo(pedido, emitir, parar.signal);
      log.info(
        {
          ms: Date.now() - inicio,
          resultado: final.tipo,
          ferramentas: final.tipo === "chamadas" ? final.chamadas.map((item) => item.nome) : undefined,
        },
        "passo concluído",
      );
      emitir(final);
    } catch (error) {
      if (!parar.signal.aborted) {
        log.error(
          { ms: Date.now() - inicio, err: mensagemDaFalha(error), bruto: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) },
          "passo do assistente falhou",
        );
        emitir({ tipo: "erro", message: mensagemDaFalha(error) });
      }
    } finally {
      terminou = true;
      clearInterval(sinalDeVida);
      res.end();
    }
  };
}

export async function tratarTeste(req: IncomingMessage, res: ServerResponse) {
  try {
    const lido = pedidoDeTeste.safeParse(JSON.parse(await lerCorpo(req)));
    if (!lido.success) {
      enviar(res, 400, { message: "Pedido inválido para o teste." });
      return;
    }
    enviar(res, 200, await testarProvedor(lido.data));
  } catch {
    enviar(res, 400, { message: "Pedido inválido para o teste." });
  }
}

function enviar(res: ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}

async function lerCorpo(req: IncomingMessage) {
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    const bloco = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
    total += bloco.length;
    if (total > LIMITE_DO_CORPO) throw new Error("grande");
    partes.push(bloco);
  }
  return Buffer.concat(partes).toString("utf8");
}
