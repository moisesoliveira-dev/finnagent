import { randomUUID } from "node:crypto";
import { CallbackHandler } from "@langfuse/langchain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  ESPECIALISTAS_IA,
  ESQUEMA_ENCAMINHAR,
  ESQUEMA_PERGUNTAR,
  FERRAMENTA_ENCAMINHAR,
  FERRAMENTA_PERGUNTAR,
  INFO_DOS_AGENTES,
  ferramentasDo,
  type AgenteIa,
  type EspecialistaIa,
  type EventoDoPasso,
  type MensagemDoModelo,
  type ModeloResolvido,
  type PedidoDePasso,
} from "@finnagent/contracts";
import { conversaParaTriagem, escolhaDaTriagem, mensagensPara, textoDe } from "../dominio/mensagens.js";
import { promptDaConversa, promptDaTriagem, promptDoEspecialista } from "../dominio/prompts.js";
import { FalhaDoModelo, ModeloAusente } from "../dominio/erros.js";
import type { FabricaDeModelos } from "../portas/fabrica-de-modelos.js";

/** Passadas de vez entre especialistas num mesmo passo, para não ficarem num jogo de empurra. */
const LIMITE_DE_ENCAMINHAMENTOS = 3;

type Emitir = (evento: EventoDoPasso) => void;

type Execucao = { pedido: PedidoDePasso; emitir: Emitir };

const Estado = Annotation.Root({
  mensagens: Annotation<MensagemDoModelo[]>({ reducer: (atual, novas) => atual.concat(novas), default: () => [] }),
  agenteAtivo: Annotation<EspecialistaIa | null>({ reducer: (_atual, novo) => novo, default: () => null }),
  encaminhamentos: Annotation<number>({ reducer: (_atual, novo) => novo, default: () => 0 }),
  notas: Annotation<string[]>({ reducer: (atual, novas) => atual.concat(novas), default: () => [] }),
  saida: Annotation<EventoDoPasso | null>({ reducer: (_atual, nova) => nova, default: () => null }),
});

type EstadoDoGrafo = typeof Estado.State;

function execucaoDe(config: RunnableConfig): Execucao {
  const execucao = config.configurable?.execucao as Execucao | undefined;
  if (!execucao) throw new Error("Passo sem execução.");
  return execucao;
}

function modeloDe(pedido: PedidoDePasso, agente: AgenteIa): ModeloResolvido {
  const modelo = pedido.modelos[agente] ?? pedido.modelos.coordenador;
  if (!modelo?.model) throw new ModeloAusente(agente);
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

function nomeDe(agente: AgenteIa) {
  return INFO_DOS_AGENTES[agente].nome;
}

export function criarGrafoDoAssistente(fabrica: FabricaDeModelos) {
  async function coordenador(estado: EstadoDoGrafo, config: RunnableConfig): Promise<Partial<EstadoDoGrafo>> {
    const { pedido, emitir } = execucaoDe(config);
    emitir({ tipo: "agente", agente: "coordenador" });
    const modelo = modeloDe(pedido, "coordenador");
    const triagem = await fabrica
      .criar(modelo, 0)
      .invoke([new SystemMessage(promptDaTriagem(pedido.contexto)), new HumanMessage(conversaParaTriagem(estado.mensagens))], config)
      .catch((error: unknown) => {
        if (error instanceof Error && /temperature/i.test(error.message)) {
          return fabrica.criar(modelo, null).invoke(
            [new SystemMessage(promptDaTriagem(pedido.contexto)), new HumanMessage(conversaParaTriagem(estado.mensagens))],
            config,
          );
        }
        throw error;
      });
    const escolhido = escolhaDaTriagem(textoDe(triagem.content));
    if (escolhido) {
      return { agenteAtivo: escolhido, notas: [`Coordenador passou o pedido para ${nomeDe(escolhido)}.`] };
    }
    const resposta = await comTemperatura(fabrica, modelo, pedido.temperatura, (chat, mostrar) =>
      transmitir(
        chat,
        [new SystemMessage(promptDaConversa(pedido.contexto, pedido.instrucoes)), ...mensagensPara(null, estado.mensagens)],
        config,
        emitir,
        mostrar,
      ),
    );
    return { saida: { tipo: "resposta", agente: "coordenador", texto: textoDe(resposta.content), notas: estado.notas } };
  }

  function especialista(agente: EspecialistaIa) {
    return async (estado: EstadoDoGrafo, config: RunnableConfig): Promise<Partial<EstadoDoGrafo>> => {
      const { pedido, emitir } = execucaoDe(config);
      emitir({ tipo: "agente", agente });
      const podeEncaminhar = estado.encaminhamentos < LIMITE_DE_ENCAMINHAMENTOS;
      const ferramentas = [
        ...ferramentasDo(agente).map((item) => ({ name: item.nome, description: item.descricao, schema: item.esquema })),
        {
          name: FERRAMENTA_PERGUNTAR,
          description: "Pergunta à pessoa com opções de resposta, quando faltar uma escolha que só ela pode fazer.",
          schema: ESQUEMA_PERGUNTAR,
        },
        ...(podeEncaminhar
          ? [
              {
                name: FERRAMENTA_ENCAMINHAR,
                description: "Passa o pedido, ou a parte que falta, para outro especialista.",
                schema: ESQUEMA_ENCAMINHAR,
              },
            ]
          : []),
      ];
      const mensagens = [
        new SystemMessage(promptDoEspecialista(agente, pedido.contexto, pedido.instrucoes)),
        ...mensagensPara(agente, estado.mensagens),
      ];
      const final = await comTemperatura(fabrica, modeloDe(pedido, agente), pedido.temperatura, (chat, mostrar) => {
        if (!chat.bindTools) throw new FalhaDoModelo(`O modelo de ${nomeDe(agente)} não aceita ferramentas.`);
        return transmitir(chat.bindTools(ferramentas), mensagens, config, emitir, mostrar);
      });
      const texto = textoDe(final.content);
      const chamadas = (final.tool_calls ?? []).map((chamada) => ({
        id: chamada.id || randomUUID(),
        nome: chamada.name,
        args: (chamada.args ?? {}) as Record<string, unknown>,
      }));

      const pedidoDeEncaminhar = chamadas.find((chamada) => chamada.nome === FERRAMENTA_ENCAMINHAR);
      const encaminhar = pedidoDeEncaminhar ? ESQUEMA_ENCAMINHAR.safeParse(pedidoDeEncaminhar.args) : null;
      if (encaminhar?.success && encaminhar.data.agente !== agente && podeEncaminhar) {
        const nota = `${nomeDe(agente)} passou para ${nomeDe(encaminhar.data.agente)}: ${encaminhar.data.motivo}`;
        return {
          agenteAtivo: encaminhar.data.agente,
          encaminhamentos: estado.encaminhamentos + 1,
          notas: [nota],
          mensagens: [{ role: "assistant", content: [texto, nota].filter(Boolean).join("\n"), agente }],
        };
      }

      const paraExecutar = chamadas.filter((chamada) => chamada.nome !== FERRAMENTA_ENCAMINHAR);
      if (paraExecutar.length) {
        return { saida: { tipo: "chamadas", agente, texto, chamadas: paraExecutar, notas: estado.notas } };
      }
      return {
        saida: { tipo: "resposta", agente, texto: texto || "Não consegui concluir esse pedido.", notas: estado.notas },
      };
    };
  }

  // Começa no coordenador, ou direto no especialista que pediu ferramentas no passo anterior.
  // Depois de cada nó: com saída, termina; sem saída, vai para quem recebeu o pedido.
  const inicio = (estado: EstadoDoGrafo) => estado.agenteAtivo ?? "coordenador";
  const seguir = (estado: EstadoDoGrafo) => (estado.saida ? END : (estado.agenteAtivo ?? END));
  const destinos: Array<EspecialistaIa | "__end__"> = [...ESPECIALISTAS_IA, END];
  const grafo = new StateGraph(Estado)
    .addNode("coordenador", coordenador)
    .addNode("financas", especialista("financas"))
    .addNode("agenda", especialista("agenda"))
    .addNode("organizacao", especialista("organizacao"))
    .addNode("metas", especialista("metas"))
    .addNode("extratos", especialista("extratos"))
    .addNode("analise", especialista("analise"))
    .addConditionalEdges(START, inicio, ["coordenador", ...ESPECIALISTAS_IA])
    .addConditionalEdges("coordenador", seguir, destinos)
    .addConditionalEdges("financas", seguir, destinos)
    .addConditionalEdges("agenda", seguir, destinos)
    .addConditionalEdges("organizacao", seguir, destinos)
    .addConditionalEdges("metas", seguir, destinos)
    .addConditionalEdges("extratos", seguir, destinos)
    .addConditionalEdges("analise", seguir, destinos)
    .compile();

  return {
    /** Roda até precisar de ferramenta ou até ter a resposta. O texto vai saindo por `emitir`. */
    async passo(pedido: PedidoDePasso, emitir: Emitir, sinal?: AbortSignal): Promise<EventoDoPasso> {
      const estado = await grafo.invoke(
        { mensagens: pedido.mensagens, agenteAtivo: pedido.agenteAtivo },
        { configurable: { execucao: { pedido, emitir } }, callbacks: observadores(), signal: sinal, recursionLimit: 20 },
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
