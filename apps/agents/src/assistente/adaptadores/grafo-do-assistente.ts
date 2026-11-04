import { randomUUID } from "node:crypto";
import { CallbackHandler } from "@langfuse/langchain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
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
import {
  AVISO_DA_PROMESSA,
  AVISO_DA_SEGUNDA_CHANCE,
  anunciaMudanca,
  escolhaDaSegundaChance,
  recusouEscrita,
  recusouPlano,
} from "../dominio/anuncio.js";
import { avisoDeContextoCortado, tokensEstimados } from "../dominio/contexto.js";
import { mensagensPara, textoDe } from "../dominio/mensagens.js";
import { promptDoConsultor } from "../dominio/prompts.js";
import { FalhaDoModelo, ModeloAusente } from "../dominio/erros.js";
import { log } from "../../log.js";
import type { FabricaDeModelos } from "../portas/fabrica-de-modelos.js";
import { ferramentasDoGemini, restaurarJson } from "./esquema-do-gemini.js";

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
      "Propõe à pessoa o plano do que vai mudar no sistema: o entendimento, as suposições e os passos com as ferramentas e os argumentos exatos. Nada muda antes de ela aprovar; depois, o sistema executa os passos na ordem. É o único jeito de criar, editar, pagar, cancelar ou apagar. No máximo 20 passos: várias linhas de extrato únicas vão num passo só, acumular_linhas.",
    schema: ESQUEMA_PLANO,
  },
];

type Ferramentas = Parameters<NonNullable<BaseChatModel["bindTools"]>>[0];

// O Gemini recusa parte do JSON Schema: ele recebe as ferramentas convertidas, montadas uma vez só.
let doGemini: ReturnType<typeof ferramentasDoGemini> | null = null;

function ferramentasPara(modelo: ModeloResolvido): Ferramentas {
  if (modelo.kind !== "google") return FERRAMENTAS;
  doGemini ??= ferramentasDoGemini(FERRAMENTAS);
  return doGemini.tools;
}

// O tamanho das ferramentas no pedido, para saber se o Ollama cortou o que recebeu.
const CARACTERES_DAS_FERRAMENTAS = FERRAMENTAS.reduce(
  (soma, ferramenta) => soma + ferramenta.name.length + ferramenta.description.length + JSON.stringify(toJsonSchema(ferramenta.schema)).length,
  0,
);

function caracteresDe(mensagens: BaseMessage[]) {
  return mensagens.reduce((soma, mensagem) => {
    const chamadas = "tool_calls" in mensagem && Array.isArray(mensagem.tool_calls) ? JSON.stringify(mensagem.tool_calls).length : 0;
    return soma + textoDe(mensagem.content).length + chamadas;
  }, CARACTERES_DAS_FERRAMENTAS);
}

/** A instrução do consultor. Na Anthropic, marca o cache: ferramentas e instrução, iguais a cada volta, saem bem mais baratas. */
function instrucao(modelo: ModeloResolvido, texto: string) {
  if (modelo.kind !== "anthropic") return new SystemMessage(texto);
  return new SystemMessage({ content: [{ type: "text", text: texto, cache_control: { type: "ephemeral" } }] });
}

function chamadasDe(final: AIMessageChunk, modelo: ModeloResolvido) {
  const emTexto = modelo.kind === "google" ? doGemini?.emTexto : undefined;
  return (final.tool_calls ?? []).map((chamada) => {
    const args = (chamada.args ?? {}) as Record<string, unknown>;
    const caminhos = emTexto?.get(chamada.name);
    return {
      id: chamada.id || randomUUID(),
      nome: chamada.name,
      args: caminhos ? restaurarJson(args, caminhos) : args,
    };
  });
}

/**
 * A segunda volta do consultor: a mesma conversa, mais o que ele acabou de dizer e o aviso do sistema, com uma
 * ferramenta obrigada (propor_plano, ou qualquer uma). Se o provedor não aceitar escolher a ferramenta, a volta
 * falha e a resposta de texto original é mantida. Com propor_plano obrigado, só o plano conta.
 */
async function segundaVolta(
  fabrica: FabricaDeModelos,
  pedido: PedidoDePasso,
  mensagens: BaseMessage[],
  texto: string,
  escolha: string,
  aviso: string,
  config: RunnableConfig,
  emitir: Emitir,
) {
  const segunda = [...mensagens, ...(texto.trim() ? [new AIMessage(texto)] : []), new HumanMessage(aviso)];
  try {
    const final = await comTemperatura(fabrica, modeloDe(pedido), pedido.temperatura, (chat, mostrar) => {
      if (!chat.bindTools) throw new FalhaDoModelo(`O modelo do ${INFO_DOS_AGENTES[CONSULTOR].nome} não aceita ferramentas.`);
      return transmitir(chat.bindTools(ferramentasPara(modeloDe(pedido)), { tool_choice: escolha }), segunda, config, emitir, mostrar);
    });
    const chamadas = chamadasDe(final, modeloDe(pedido));
    return escolha === FERRAMENTA_PLANO ? chamadas.filter((chamada) => chamada.nome === FERRAMENTA_PLANO) : chamadas;
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
    const modelo = modeloDe(pedido);
    const mensagens = [
      instrucao(modelo, promptDoConsultor(pedido.contexto, pedido.instrucoes)),
      ...mensagensPara(CONSULTOR, estado.mensagens),
    ];
    const final = await comTemperatura(fabrica, modelo, pedido.temperatura, (chat, mostrar) => {
      if (!chat.bindTools) throw new FalhaDoModelo(`O modelo do ${INFO_DOS_AGENTES[CONSULTOR].nome} não aceita ferramentas.`);
      return transmitir(chat.bindTools(ferramentasPara(modelo)), mensagens, config, emitir, mostrar);
    });
    const cortado = avisoDeContextoCortado(modelo.kind, final.usage_metadata?.input_tokens, tokensEstimados(caracteresDe(mensagens)));
    if (cortado) throw new FalhaDoModelo(cortado);
    const texto = textoDe(final.content);
    const chamadas = chamadasDe(final, modelo);
    if (chamadas.length) return { saida: { tipo: "chamadas", agente: CONSULTOR, texto, chamadas, notas: [] } };

    // Só texto, mas o texto promete agir ("vou criar...", "vou revisar a conferência"), ou vem logo depois de uma
    // recusa do backend (escrita fora do plano, plano grande demais): o consultor narrou em vez de agir. Uma segunda
    // volta obriga a ferramenta. O texto fica, e o que ele chamou aparece logo depois dele.
    const refazOPlano = recusouEscrita(pedido.mensagens) || recusouPlano(pedido.mensagens);
    if (refazOPlano || anunciaMudanca(texto)) {
      const escolha = escolhaDaSegundaChance(texto, pedido.mensagens);
      const aviso = escolha === FERRAMENTA_PLANO ? AVISO_DA_SEGUNDA_CHANCE : AVISO_DA_PROMESSA;
      const segunda = await segundaVolta(fabrica, pedido, mensagens, texto, escolha, aviso, config, emitir);
      if (segunda.length) {
        log.info({ escolha, ferramentas: segunda.map((chamada) => chamada.nome) }, "o consultor narrou em vez de agir; a segunda volta chamou a ferramenta");
        return { saida: { tipo: "chamadas", agente: CONSULTOR, texto, chamadas: segunda, notas: [] } };
      }
      log.warn({ escolha }, "o consultor narrou em vez de agir, e a segunda volta também não chamou ferramenta");
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
