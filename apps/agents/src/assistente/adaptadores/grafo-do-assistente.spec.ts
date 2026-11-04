import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import {
  RECUSA_DE_ESCRITA_FORA_DO_PLANO,
  RECUSA_DE_PLANO,
  type EventoDoPasso,
  type ModeloResolvido,
  type PedidoDePasso,
} from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import type { FabricaDeModelos } from "../portas/fabrica-de-modelos.js";
import { criarGrafoDoAssistente } from "./grafo-do-assistente.js";

/** Chat de mentira: devolve as respostas na ordem e guarda o que viu e as ferramentas que recebeu. */
class Roteiro extends BaseChatModel {
  vistos: BaseMessage[][] = [];
  ferramentas: string[][] = [];
  /** A escolha de ferramenta de cada bindTools: undefined quando o modelo fica livre. */
  escolhas: Array<string | undefined> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brutas: any[][] = [];

  constructor(private readonly respostas: AIMessage[]) {
    super({});
  }

  _llmType() {
    return "roteiro";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bindTools(tools: any[], opcoes?: { tool_choice?: string }): any {
    this.ferramentas.push(tools.map((item: { name?: string; function?: { name: string } }) => item.name ?? item.function?.name ?? ""));
    this.brutas.push(tools);
    this.escolhas.push(opcoes?.tool_choice);
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

  describe("segunda chance quando o consultor narra o plano em vez de propô-lo", () => {
    const plano = { objetivo: "Criar a família", entendimento: "Organização.", passos: [] };
    const promessa = "Posso organizar isso, mas preciso propor o plano antes de mudar. Vou criar o grupo Família.";

    it("repete a volta obrigando propor_plano e devolve o texto junto com o plano", async () => {
      const consultor = new Roteiro([new AIMessage(promessa), chamada("propor_plano", plano)]);
      const { fabrica } = fabricaCom({ consultor });
      const { final } = await rodar(fabrica, pedido({ mensagens: [{ role: "user", content: "Família: Fonseca e Seixas" }] }));
      expect(final).toMatchObject({ tipo: "chamadas", agente: "coordenador", texto: promessa, chamadas: [{ nome: "propor_plano", args: plano }] });
      expect(consultor.escolhas).toEqual([undefined, "propor_plano"]);
      const segunda = consultor.vistos[1];
      expect(segunda.at(-1)).toBeInstanceOf(HumanMessage);
      expect(String(segunda.at(-1)?.content)).toContain("propor_plano");
      expect(segunda.at(-2)).toBeInstanceOf(AIMessage);
      expect(String(segunda.at(-2)?.content)).toBe(promessa);
    });

    it("não repete a volta numa resposta de conversa nem numa pergunta", async () => {
      for (const texto of ["Você tem 2 metas e a sobra é R$ 1.935,90.", "Quer que eu crie o grupo Família?"]) {
        const consultor = new Roteiro([new AIMessage(texto)]);
        const { fabrica } = fabricaCom({ consultor });
        const { final } = await rodar(fabrica, pedido());
        expect(final).toMatchObject({ tipo: "resposta", texto });
        expect(consultor.vistos).toHaveLength(1);
      }
    });

    it("repete a volta logo depois de uma escrita recusada, mesmo sem promessa no texto", async () => {
      const consultor = new Roteiro([new AIMessage("Não consegui criar o grupo."), chamada("propor_plano", plano)]);
      const { fabrica } = fabricaCom({ consultor });
      const { final } = await rodar(
        fabrica,
        pedido({
          mensagens: [
            { role: "user", content: "Crie o grupo Família" },
            { role: "assistant", content: "", agente: "coordenador", toolCalls: [{ id: "c1", nome: "criar_grupo", args: { name: "Família" } }] },
            { role: "tool", content: `${RECUSA_DE_ESCRITA_FORA_DO_PLANO} Chame propor_plano.`, toolCallId: "c1", nome: "criar_grupo", agente: "coordenador" },
          ],
        }),
      );
      expect(final).toMatchObject({ tipo: "chamadas", chamadas: [{ nome: "propor_plano" }] });
      expect(consultor.escolhas).toEqual([undefined, "propor_plano"]);
    });

    it("fica com a resposta de texto quando a segunda volta também não propõe", async () => {
      const consultor = new Roteiro([new AIMessage(promessa), new AIMessage("Vou criar o grupo Família.")]);
      const { fabrica } = fabricaCom({ consultor });
      const { final } = await rodar(fabrica, pedido());
      expect(final).toMatchObject({ tipo: "resposta", texto: promessa });
      expect(consultor.vistos).toHaveLength(2);
    });

    it("ignora uma ferramenta diferente de propor_plano na segunda volta", async () => {
      const consultor = new Roteiro([new AIMessage(promessa), chamada("criar_grupo", { name: "Família" })]);
      const { fabrica } = fabricaCom({ consultor });
      const { final } = await rodar(fabrica, pedido());
      expect(final).toMatchObject({ tipo: "resposta", texto: promessa });
    });

    it("quando o consultor promete consultar, obriga uma ferramenta qualquer e devolve o que ele chamar", async () => {
      const promessa = "Vou revisar a conferência inteira de outubro e te digo exatamente o que sobrou.";
      const consultor = new Roteiro([new AIMessage(promessa), chamada("consultar_conferencia", { year: 2026, month: 10, busca: "uber|99" })]);
      const { fabrica } = fabricaCom({ consultor });
      const { final } = await rodar(fabrica, pedido({ mensagens: [{ role: "user", content: "ainda faltou lançamentos da 99 e uber" }] }));
      expect(final).toMatchObject({
        tipo: "chamadas",
        texto: promessa,
        chamadas: [{ nome: "consultar_conferencia", args: { year: 2026, month: 10, busca: "uber|99" } }],
      });
      expect(consultor.escolhas).toEqual([undefined, "any"]);
      expect(String(consultor.vistos[1].at(-1)?.content)).toContain("não chamou nenhuma ferramenta");
    });

    it("depois de um plano recusado, a volta que só narra é repetida obrigando propor_plano", async () => {
      const plano = { objetivo: "Lançar Uber e 99", entendimento: "Saídas únicas.", passos: [] };
      const consultor = new Roteiro([
        new AIMessage("Preciso refazer o plano. Vou dividir a revisão em blocos e te mostrar o próximo passo para aprovar."),
        chamada("propor_plano", plano),
      ]);
      const { fabrica } = fabricaCom({ consultor });
      const { final } = await rodar(
        fabrica,
        pedido({
          mensagens: [
            { role: "user", content: "lance as do uber e da 99" },
            { role: "assistant", content: "", agente: "coordenador", toolCalls: [{ id: "p1", nome: "propor_plano", args: { passos: [] } }] },
            { role: "tool", content: `Plano inválido: 25 passos, e o máximo é 20. ${RECUSA_DE_PLANO}`, toolCallId: "p1", nome: "propor_plano", agente: "coordenador" },
          ],
        }),
      );
      expect(final).toMatchObject({ tipo: "chamadas", chamadas: [{ nome: "propor_plano", args: plano }] });
      expect(consultor.escolhas).toEqual([undefined, "propor_plano"]);
    });

    it("não derruba a resposta quando a segunda volta falha no provedor", async () => {
      const consultor = new Roteiro([new AIMessage(promessa)]);
      const original = consultor._generate.bind(consultor);
      let volta = 0;
      consultor._generate = async (mensagens) => {
        volta += 1;
        if (volta === 2) throw new Error("503 do provedor");
        return original(mensagens);
      };
      const { fabrica } = fabricaCom({ consultor });
      const { final } = await rodar(fabrica, pedido());
      expect(final).toMatchObject({ tipo: "resposta", texto: promessa });
    });
  });

  it("sem o modelo do consultor, não usa o de outra função", async () => {
    const { fabrica } = fabricaCom({ financas: new Roteiro([]) });
    await expect(rodar(fabrica, pedido({ modelos: { financas: modelo("financas") } }))).rejects.toThrow();
  });
});

describe("cada provedor", () => {
  const com = (kind: ModeloResolvido["kind"]): Partial<PedidoDePasso> => ({
    modelos: { coordenador: { kind, apiKey: "k", baseUrl: "", model: "consultor" }, financas: modelo("financas") },
  });

  it("no Gemini, manda as ferramentas convertidas e devolve como objeto os argumentos do plano que vieram em texto", async () => {
    const plano = {
      objetivo: "Criar o grupo",
      entendimento: "Um grupo novo.",
      suposicoes: [],
      passos: [{ ferramenta: "criar_grupo", descricao: "Criar Casa", args: '{"name":"Casa"}' }],
    };
    const consultor = new Roteiro([chamada("propor_plano", plano)]);
    const { fabrica } = fabricaCom({ consultor });
    const { final } = await rodar(fabrica, pedido(com("google")));
    expect(consultor.brutas[0]?.[0]).toMatchObject({ type: "function", function: { name: expect.any(String) } });
    expect(JSON.stringify(consultor.brutas[0])).not.toContain("propertyNames");
    expect(final).toMatchObject({ tipo: "chamadas", chamadas: [{ nome: "propor_plano", args: { passos: [{ args: { name: "Casa" } }] } }] });
  });

  it("nos outros provedores, as ferramentas vão como estão", async () => {
    const consultor = new Roteiro([new AIMessage("Oi!")]);
    const { fabrica } = fabricaCom({ consultor });
    await rodar(fabrica, pedido());
    expect(consultor.brutas[0]?.[0]).toHaveProperty("schema");
  });

  it("na Anthropic, marca o cache na instrução, que leva junto as ferramentas", async () => {
    const consultor = new Roteiro([new AIMessage("Oi!")]);
    const { fabrica } = fabricaCom({ consultor });
    await rodar(fabrica, pedido(com("anthropic")));
    const instrucao = consultor.vistos[0]?.[0];
    expect(instrucao).toBeInstanceOf(SystemMessage);
    expect(instrucao?.content).toMatchObject([{ type: "text", cache_control: { type: "ephemeral" } }]);
  });

  it("no Ollama, avisa quando o modelo leu bem menos do que foi enviado", async () => {
    const cortada = new AIMessage({ content: "resposta sem sentido", usage_metadata: { input_tokens: 2048, output_tokens: 4, total_tokens: 2052 } });
    const { fabrica } = fabricaCom({ consultor: new Roteiro([cortada]) });
    await expect(rodar(fabrica, pedido(com("ollama")))).rejects.toThrow(/Ollama cortou o pedido.*OLLAMA_CONTEXT_LENGTH/);
  });

  it("no Ollama com contexto suficiente, segue normal", async () => {
    const inteira = new AIMessage({ content: "Oi!", usage_metadata: { input_tokens: 40_000, output_tokens: 2, total_tokens: 40_002 } });
    const { fabrica } = fabricaCom({ consultor: new Roteiro([inteira]) });
    const { final } = await rodar(fabrica, pedido(com("ollama")));
    expect(final).toMatchObject({ tipo: "resposta", texto: "Oi!" });
  });
});
