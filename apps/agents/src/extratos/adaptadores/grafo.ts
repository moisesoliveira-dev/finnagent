import { CallbackHandler } from "@langfuse/langchain";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { LinhaExtrato } from "@finnagent/contracts";
import { normalizarLinhas } from "../dominio/linhas.js";
import { comModelo } from "./openai.js";
import type { LeitorDeExtrato, ModeloDeExtrato } from "../portas/leitor.js";
import type { OrganizadorDeExtrato } from "../portas/organizador.js";

const Estado = Annotation.Root({
  filename: Annotation<string>,
  mediaType: Annotation<string>,
  conteudo: Annotation<string>,
  texto: Annotation<string>({
    reducer: (_atual, proximo) => proximo,
    default: () => "",
  }),
  linhas: Annotation<LinhaExtrato[]>({
    reducer: (_atual, proximo) => proximo,
    default: () => [],
  }),
});

export function criarGrafo(leitor: LeitorDeExtrato, modelo: ModeloDeExtrato): OrganizadorDeExtrato {
  const grafo = new StateGraph(Estado)
    .addNode("ler", async (estado) => ({
      texto: await leitor.ler({
        filename: estado.filename,
        mediaType: estado.mediaType,
        conteudo: estado.conteudo,
      }),
    }))
    .addNode("organizar", async (estado) => ({
      linhas: normalizarLinhas(await modelo.organizarTexto(estado.texto)),
    }))
    .addEdge(START, "ler")
    .addEdge("ler", "organizar")
    .addEdge("organizar", END)
    .compile();

  return {
    async organizar(pedido) {
      return comModelo({ apiKey: pedido.apiKey, model: pedido.model, baseUrl: pedido.baseUrl }, async () => {
        const resultado = await grafo.invoke(
          {
            filename: pedido.filename,
            mediaType: pedido.mediaType,
            conteudo: pedido.content,
          },
          { callbacks: observadores() },
        );
        return resultado.linhas;
      });
    },
  };
}

function observadores() {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL;
  if (!publicKey || !secretKey || !baseUrl) return [];
  return [new CallbackHandler()];
}
