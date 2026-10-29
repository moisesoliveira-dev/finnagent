import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
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
    modelos: { coordenador: modelo("consultor"), financas: modelo("financas") },
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
  it("conversa sem ferramentas quando o consultor só responde", async () => {
    const consultor = new Roteiro([new AIMessage("Oi! Posso ajudar a organizar o seu financeiro.")]);
    const { fabrica } = fabricaCom({ consultor });
    const { final, eventos } = await rodar(fabrica, pedido({ mensagens: [{ role: "user", content: "oi" }] }));
    expect(final).toEqual({ tipo: "resposta", agente: "coordenador", texto: "Oi! Posso ajudar a organizar o seu financeiro.", notas: [] });
    expect(eventos).toContainEqual({ tipo: "texto", delta: "Oi! Posso ajudar a organizar o seu financeiro." });
    expect(eventos.filter((evento) => evento.tipo === "agente")).toEqual([{ tipo: "agente", agente: "coordenador" }]);
  });

  it("o consultor recebe todas as ferramentas do sistema, perguntar e propor_plano, e nada fora do alcance", async () => {
    const consultor = new Roteiro([chamada("listar_grupos_e_sessoes", {})]);
    const { fabrica, criados } = fabricaCom({ consultor });
    const { final } = await rodar(fabrica, pedido());
    expect(final).toEqual({
      tipo: "chamadas",
      agente: "coordenador",
      texto: "",
      chamadas: [{ id: "id-listar_grupos_e_sessoes", nome: "listar_grupos_e_sessoes", args: {} }],
      notas: [],
    });
    const nomes = consultor.ferramentas[0];
    for (const nome of ["criar_lancamento", "criar_compromisso", "criar_meta", "consultar_mes_financeiro", "perguntar", "propor_plano"]) {
      expect(nomes).toContain(nome);
    }
    expect(nomes).not.toContain("encaminhar");
    expect(nomes.some((nome) => /perfil|configurac|usuario|exportar|importar/.test(nome))).toBe(false);
    expect(criados.map((item) => item.model)).toEqual(["consultor"]);
  });

  it("devolve o plano ao backend e, na volta, vê o resultado das ferramentas", async () => {
    const plano = { objetivo: "Lançar o mercado", entendimento: "Gasto do dia.", passos: [] };
    const consultor = new Roteiro([chamada("propor_plano", plano), new AIMessage("Pronto: lancei R$ 50,00 de mercado.")]);
    const { fabrica } = fabricaCom({ consultor });
    const primeiro = await rodar(fabrica, pedido());
    expect(primeiro.final).toMatchObject({ tipo: "chamadas", chamadas: [{ nome: "propor_plano", args: plano }] });

    const { final } = await rodar(
      fabrica,
      pedido({
        mensagens: [
          { role: "user", content: "Lance R$ 50 de mercado hoje" },
          { role: "assistant", content: "", agente: "coordenador", toolCalls: [{ id: "p1", nome: "propor_plano", args: plano }] },
          { role: "tool", content: "A pessoa aprovou o plano.", toolCallId: "p1", nome: "propor_plano", agente: "coordenador" },
        ],
      }),
    );
    expect(final).toMatchObject({ tipo: "resposta", texto: "Pronto: lancei R$ 50,00 de mercado." });
    const visto = consultor.vistos[1];
    expect(visto[0]).toBeInstanceOf(SystemMessage);
    expect(String(visto[0].content)).toContain("propor_plano");
    expect(visto.at(-1)).toBeInstanceOf(ToolMessage);
    expect((visto.at(-2) as AIMessage).tool_calls?.[0].name).toBe("propor_plano");
  });

  it("tenta de novo sem temperatura quando o modelo recusa", async () => {
    const consultor = new Roteiro([new AIMessage("Você tem 2 metas.")]);
    const { fabrica, criados } = fabricaCom({ consultor }, true);
    const { final } = await rodar(fabrica, pedido());
    expect(final).toMatchObject({ tipo: "resposta", agente: "coordenador", texto: "Você tem 2 metas." });
    expect(criados.map((item) => item.temperatura)).toEqual([0.2, null]);
  });

  it("sem o modelo do consultor, não usa o de outra função", async () => {
    const { fabrica } = fabricaCom({ financas: new Roteiro([]) });
    await expect(rodar(fabrica, pedido({ modelos: { financas: modelo("financas") } }))).rejects.toThrow();
  });
});
