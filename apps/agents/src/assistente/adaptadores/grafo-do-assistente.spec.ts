import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import type { EventoDoPasso, ModeloResolvido, PedidoDePasso } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import type { FabricaDeModelos } from "../portas/fabrica-de-modelos.js";
import { criarGrafoDoAssistente } from "./grafo-do-assistente.js";

/** Chat de mentira: devolve as respostas na ordem e guarda o que viu e as ferramentas que recebeu. */
class Roteiro extends BaseChatModel {
  vistos: BaseMessage[][] = [];
  ferramentas: string[][] = [];

  constructor(private readonly respostas: AIMessage[]) {
    super({});
  }

  _llmType() {
    return "roteiro";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bindTools(tools: any[]): any {
    this.ferramentas.push(tools.map((item: { name: string }) => item.name));
    return this;
  }

  async _generate(mensagens: BaseMessage[]): Promise<ChatResult> {
    this.vistos.push(mensagens);
    const resposta = this.respostas.shift() ?? new AIMessage("fim do roteiro");
    return { generations: [{ text: String(resposta.content), message: resposta }] };
  }
}

function fabricaCom(modelos: Record<string, Roteiro>, recusarTemperatura = false) {
  const criados: Array<{ model: string; temperatura: number | null }> = [];
  const fabrica: FabricaDeModelos = {
    criar(modelo: ModeloResolvido, temperatura: number | null) {
      criados.push({ model: modelo.model, temperatura });
      const roteiro = modelos[modelo.model];
      if (!roteiro) throw new Error(`sem roteiro para ${modelo.model}`);
      if (recusarTemperatura && temperatura !== null && temperatura > 0) {
        const recusa = new Roteiro([]);
        recusa._generate = async () => {
          throw new Error("Unsupported value: 'temperature' does not support 0.2 with this model.");
        };
        return recusa;
      }
      return roteiro;
    },
  };
  return { fabrica, criados };
}

const modelo = (nome: string): ModeloResolvido => ({ kind: "openai", apiKey: "k", baseUrl: "", model: nome });

function pedido(extra: Partial<PedidoDePasso> = {}): PedidoDePasso {
  return {
    modelos: {
      coordenador: modelo("triagem"),
      financas: modelo("financas"),
      agenda: modelo("agenda"),
      metas: modelo("metas"),
    },
    temperatura: 0.2,
    instrucoes: "",
    contexto: { hoje: "2026-10-28", usuario: "Ana", fuso: "America/Sao_Paulo" },
    mensagens: [{ role: "user", content: "Lance R$ 50 de mercado hoje" }],
    agenteAtivo: null,
    ...extra,
  };
}

const chamada = (name: string, args: Record<string, unknown>, id = `id-${name}`) =>
  new AIMessage({ content: "", tool_calls: [{ id, name, args, type: "tool_call" }] });

async function rodar(fabrica: FabricaDeModelos, entrada: PedidoDePasso) {
  const eventos: EventoDoPasso[] = [];
  const final = await criarGrafoDoAssistente(fabrica).passo(entrada, (evento) => eventos.push(evento));
  return { final, eventos };
}

describe("grafo do assistente", () => {
  it("conversa sem ferramentas quando a triagem não chama ninguém", async () => {
    const triagem = new Roteiro([new AIMessage("nenhum"), new AIMessage("Oi! Posso lançar, agendar e analisar.")]);
    const { fabrica } = fabricaCom({ triagem });
    const { final, eventos } = await rodar(fabrica, pedido({ mensagens: [{ role: "user", content: "oi" }] }));
    expect(final).toMatchObject({ tipo: "resposta", agente: "coordenador", texto: "Oi! Posso lançar, agendar e analisar." });
    expect(eventos).toContainEqual({ tipo: "texto", delta: "Oi! Posso lançar, agendar e analisar." });
    expect(triagem.ferramentas).toEqual([]);
  });

  it("passa para o especialista, que recebe só as ferramentas dele e devolve as chamadas ao backend", async () => {
    const triagem = new Roteiro([new AIMessage("financas")]);
    const financas = new Roteiro([chamada("listar_grupos_e_sessoes", {})]);
    const { fabrica } = fabricaCom({ triagem, financas });
    const { final, eventos } = await rodar(fabrica, pedido());
    expect(final).toMatchObject({
      tipo: "chamadas",
      agente: "financas",
      chamadas: [{ id: "id-listar_grupos_e_sessoes", nome: "listar_grupos_e_sessoes", args: {} }],
      notas: ["Coordenador passou o pedido para Finanças."],
    });
    expect(eventos.filter((evento) => evento.tipo === "agente")).toEqual([
      { tipo: "agente", agente: "coordenador" },
      { tipo: "agente", agente: "financas" },
    ]);
    const nomes = financas.ferramentas[0];
    expect(nomes).toContain("criar_lancamento");
    expect(nomes).toContain("perguntar");
    expect(nomes).toContain("encaminhar");
    expect(nomes).not.toContain("criar_compromisso");
    expect(nomes.some((nome) => /perfil|configurac|usuario|exportar|importar/.test(nome))).toBe(false);
  });

  it("continua no especialista ativo, sem triagem, vendo o resultado das ferramentas dele", async () => {
    const triagem = new Roteiro([]);
    const financas = new Roteiro([new AIMessage("Pronto: lancei R$ 50,00 de mercado.")]);
    const { fabrica, criados } = fabricaCom({ triagem, financas });
    const { final } = await rodar(
      fabrica,
      pedido({
        agenteAtivo: "financas",
        mensagens: [
          { role: "user", content: "Lance R$ 50 de mercado hoje" },
          {
            role: "assistant",
            content: "",
            agente: "financas",
            toolCalls: [{ id: "c1", nome: "criar_lancamento", args: { name: "Mercado" } }],
          },
          { role: "tool", content: '{"ok":true}', toolCallId: "c1", nome: "criar_lancamento", agente: "financas" },
        ],
      }),
    );
    expect(final).toMatchObject({ tipo: "resposta", agente: "financas", texto: "Pronto: lancei R$ 50,00 de mercado." });
    expect(criados.map((item) => item.model)).not.toContain("triagem");
    const visto = financas.vistos[0];
    expect(visto.at(-1)).toBeInstanceOf(ToolMessage);
    expect((visto.at(-2) as AIMessage).tool_calls?.[0].name).toBe("criar_lancamento");
  });

  it("encaminha para outro especialista, que vê o motivo como nota", async () => {
    const triagem = new Roteiro([new AIMessage("financas")]);
    const financas = new Roteiro([chamada("encaminhar", { agente: "agenda", motivo: "marcar o dentista na sexta" })]);
    const agenda = new Roteiro([new AIMessage("Marquei o dentista na sexta.")]);
    const { fabrica } = fabricaCom({ triagem, financas, agenda });
    const { final } = await rodar(fabrica, pedido());
    expect(final).toMatchObject({ tipo: "resposta", agente: "agenda" });
    expect(final.tipo === "resposta" && final.notas).toEqual([
      "Coordenador passou o pedido para Finanças.",
      "Finanças passou para Agenda: marcar o dentista na sexta",
    ]);
    const pedidoVisto = agenda.vistos[0].find((item) => item instanceof HumanMessage);
    expect(String(pedidoVisto?.content)).toContain("marcar o dentista na sexta");
  });

  it("para o pingue-pongue: depois de 3 passadas o especialista não recebe mais o encaminhar", async () => {
    const triagem = new Roteiro([new AIMessage("financas")]);
    const ida = () => chamada("encaminhar", { agente: "agenda", motivo: "é da agenda" });
    const volta = () => chamada("encaminhar", { agente: "financas", motivo: "é de finanças" });
    const financas = new Roteiro([ida(), ida()]);
    const agenda = new Roteiro([volta(), volta()]);
    const { fabrica } = fabricaCom({ triagem, financas, agenda });
    const { final } = await rodar(fabrica, pedido());
    expect(final).toMatchObject({ tipo: "resposta", texto: "Não consegui concluir esse pedido." });
    expect(agenda.ferramentas.at(-1)).not.toContain("encaminhar");
  });

  it("tenta de novo sem temperatura quando o modelo recusa", async () => {
    const triagem = new Roteiro([new AIMessage("metas")]);
    const metas = new Roteiro([new AIMessage("Você tem 2 metas.")]);
    const { fabrica, criados } = fabricaCom({ triagem, metas }, true);
    const { final } = await rodar(fabrica, pedido());
    expect(final).toMatchObject({ tipo: "resposta", agente: "metas", texto: "Você tem 2 metas." });
    expect(criados.filter((item) => item.model === "metas").map((item) => item.temperatura)).toEqual([0.2, null]);
  });

  it("usa o modelo do coordenador para o especialista sem modelo próprio", async () => {
    const triagem = new Roteiro([new AIMessage("analise"), new AIMessage("Gastou R$ 300,00.")]);
    const { fabrica } = fabricaCom({ triagem });
    const { final } = await rodar(fabrica, pedido());
    expect(final).toMatchObject({ tipo: "resposta", agente: "analise", texto: "Gastou R$ 300,00." });
  });
});
