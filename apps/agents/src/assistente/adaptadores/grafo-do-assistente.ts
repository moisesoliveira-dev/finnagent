import { randomUUID } from "node:crypto";
import { CallbackHandler } from "@langfuse/langchain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  ESQUEMA_PERGUNTAR,
  ESQUEMA_PLANO,
  FERRAMENTA_PERGUNTAR,
  FERRAMENTA_PLANO,
  FERRAMENTAS_DO_ASSISTENTE,
  INFO_DOS_AGENTES,
  type AgenteIa,
  type EventoDoPasso,
  type MensagemDoModelo,
  type ModeloResolvido,
  type PedidoDePasso,
} from "@finnagent/contracts";
import { AVISO_DA_SEGUNDA_CHANCE, anunciaMudanca, recusouEscrita } from "../dominio/anuncio.js";
import { mensagensPara, textoDe } from "../dominio/mensagens.js";
import { promptDoConsultor } from "../dominio/prompts.js";
import { FalhaDoModelo, ModeloAusente } from "../dominio/erros.js";
import { log } from "../../log.js";
import type { FabricaDeModelos } from "../portas/fabrica-de-modelos.js";

/** O assistente é um agente só, o consultor, com todas as ferramentas. Ele usa o modelo da função coordenador. */
const CONSULTOR: AgenteIa = "coordenador";

type Emitir = (evento: EventoDoPasso) => void;

type Execucao = { pedido: PedidoDePasso; emitir: Emitir };

const Estado = Annotation.Root({
  mensagens: Annotation<MensagemDoModelo[]>({ reducer: (atual, novas) => atual.concat(novas), default: () => [] }),
  saida: Annotation<EventoDoPasso | null>({ reducer: (_atual, nova) => nova, default: () => null }),
});

type EstadoDoGrafo = typeof Estado.State;

function execucaoDe(config: RunnableConfig): Execucao {
  const execucao = config.configurable?.execucao as Execucao | undefined;
  if (!execucao) throw new Error("Passo sem execução.");
  return execucao;
}

function modeloDe(pedido: PedidoDePasso): ModeloResolvido {
  const modelo = pedido.modelos[CONSULTOR];
  if (!modelo?.model) throw new ModeloAusente(CONSULTOR);
  return modelo;
}

/** Modelos de raciocínio recusam temperatura. Na recusa, tenta de novo sem ela, se ainda nada foi mostrado. */
async function comTemperatura<T>(
  fabrica: FabricaDeModelos,
  modelo: ModeloResolvido,
  temperatura: number,
  fazer: (chat: BaseChatModel, podeRepetir: () => boolean) => Promise<T>,
) {
  let mostrou = false;
  const marcar = () => {
    mostrou = true;
    return true;
  };
  try {
    return await fazer(fabrica.criar(modelo, temperatura), () => !mostrou && marcar());
  } catch (error) {
    if (mostrou || !(error instanceof Error) || !/temperature/i.test(error.message)) throw error;
    return fazer(fabrica.criar(modelo, null), () => true);
  }
}

/** Repassa o texto à medida que chega e devolve a mensagem inteira, com as chamadas de ferramenta. */
async function transmitir(
  chat: { stream: BaseChatModel["stream"] },
  mensagens: BaseMessage[],
  config: RunnableConfig,
  emitir: Emitir,
  mostrar: () => boolean,
) {
  let final: AIMessageChunk | undefined;
  const fluxo = await chat.stream(mensagens, config);
  for await (const pedaco of fluxo) {
    final = final ? final.concat(pedaco) : pedaco;
    const delta = textoDe(pedaco.content);
    if (delta) {
      mostrar();
      emitir({ tipo: "texto", delta });
    }
  }
  return final ?? new AIMessageChunk("");
}

// Todas as ferramentas do sistema, mais as duas que o backend trata: perguntar e propor o plano.
const FERRAMENTAS = [
  ...FERRAMENTAS_DO_ASSISTENTE.map((item) => ({ name: item.nome, description: item.descricao, schema: item.esquema })),
  {
    name: FERRAMENTA_PERGUNTAR,
    description: "Pergunta à pessoa com opções de resposta, quando faltar uma escolha que muda o caminho e não dá para supor.",
    schema: ESQUEMA_PERGUNTAR,
  },
  {
    name: FERRAMENTA_PLANO,
    description:
      "Propõe à pessoa o plano do que vai mudar no sistema: o entendimento, as suposições e os passos com as ferramentas e os argumentos exatos. Nada muda antes de ela aprovar; depois, o sistema executa os passos na ordem. É o único jeito de criar, editar, pagar, cancelar ou apagar.",
    schema: ESQUEMA_PLANO,
  },
];

function chamadasDe(final: AIMessageChunk) {
  return (final.tool_calls ?? []).map((chamada) => ({
    id: chamada.id || randomUUID(),
    nome: chamada.name,
    args: (chamada.args ?? {}) as Record<string, unknown>,
  }));
}

/**
 * A segunda volta do consultor: a mesma conversa, mais o que ele acabou de dizer e o aviso do sistema, com
 * propor_plano como única saída. Se o provedor não aceitar escolher a ferramenta, repete só com o aviso.
 */
async function proporOPlano(
  fabrica: FabricaDeModelos,
  pedido: PedidoDePasso,
  mensagens: BaseMessage[],
  texto: string,
  config: RunnableConfig,
  emitir: Emitir,
) {
  const segunda = [...mensagens, ...(texto.trim() ? [new AIMessage(texto)] : []), new HumanMessage(AVISO_DA_SEGUNDA_CHANCE)];
  try {
    const final = await comTemperatura(fabrica, modeloDe(pedido), pedido.temperatura, (chat, mostrar) => {
      if (!chat.bindTools) throw new FalhaDoModelo(`O modelo do ${INFO_DOS_AGENTES[CONSULTOR].nome} não aceita ferramentas.`);
      return transmitir(chat.bindTools(FERRAMENTAS, { tool_choice: FERRAMENTA_PLANO }), segunda, config, emitir, mostrar);
    });
    return chamadasDe(final).filter((chamada) => chamada.nome === FERRAMENTA_PLANO);
  } catch (error) {
    if (error instanceof FalhaDoModelo || error instanceof ModeloAusente) throw error;
    // Um erro aqui não pode derrubar a resposta que o consultor já deu.
    log.warn({ err: error instanceof Error ? error.message : String(error) }, "a segunda volta do consultor falhou");
    return [];
  }
}

export function criarGrafoDoAssistente(fabrica: FabricaDeModelos) {
  /** O consultor: lê a conversa, consulta, pergunta ou propõe o plano. Uma volta por passo do backend. */
  async function consultor(estado: EstadoDoGrafo, config: RunnableConfig): Promise<Partial<EstadoDoGrafo>> {
    const { pedido, emitir } = execucaoDe(config);
    emitir({ tipo: "agente", agente: CONSULTOR });
    const mensagens = [
      new SystemMessage(promptDoConsultor(pedido.contexto, pedido.instrucoes)),
      ...mensagensPara(CONSULTOR, estado.mensagens),
    ];
    const final = await comTemperatura(fabrica, modeloDe(pedido), pedido.temperatura, (chat, mostrar) => {
      if (!chat.bindTools) throw new FalhaDoModelo(`O modelo do ${INFO_DOS_AGENTES[CONSULTOR].nome} não aceita ferramentas.`);
      return transmitir(chat.bindTools(FERRAMENTAS), mensagens, config, emitir, mostrar);
    });
    const texto = textoDe(final.content);
    const chamadas = chamadasDe(final);
    if (chamadas.length) return { saida: { tipo: "chamadas", agente: CONSULTOR, texto, chamadas, notas: [] } };

    // Só texto, mas o texto promete uma mudança ("vou criar...") ou vem logo depois de uma escrita recusada: o
    // consultor narrou o plano em vez de propô-lo. Uma segunda volta obriga propor_plano. O texto fica, e o plano
    // aparece logo depois dele.
    if (anunciaMudanca(texto) || recusouEscrita(pedido.mensagens)) {
      const plano = await proporOPlano(fabrica, pedido, mensagens, texto, config, emitir);
      if (plano.length) {
        log.info({ ferramenta: FERRAMENTA_PLANO }, "o consultor anunciou a mudança sem propor o plano; a segunda volta propôs");
        return { saida: { tipo: "chamadas", agente: CONSULTOR, texto, chamadas: plano, notas: [] } };
      }
      log.warn("o consultor anunciou a mudança sem propor o plano, e a segunda volta também não propôs");
    }
    return { saida: { tipo: "resposta", agente: CONSULTOR, texto: texto || "Não consegui concluir esse pedido.", notas: [] } };
  }

  const grafo = new StateGraph(Estado).addNode("consultor", consultor).addEdge(START, "consultor").addEdge("consultor", END).compile();

  return {
    /** Roda até precisar de ferramenta ou até ter a resposta. O texto vai saindo por `emitir`. */
    async passo(pedido: PedidoDePasso, emitir: Emitir, sinal?: AbortSignal): Promise<EventoDoPasso> {
      const estado = await grafo.invoke(
        { mensagens: pedido.mensagens },
        { configurable: { execucao: { pedido, emitir } }, callbacks: observadores(), signal: sinal, recursionLimit: 5 },
      );
      return estado.saida ?? { tipo: "erro", message: "O assistente não chegou a uma resposta." };
    },
  };
}

function observadores() {
  const { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL } = process.env;
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY || !LANGFUSE_BASE_URL) return [];
  return [new CallbackHandler()];
}
