import { RECUSA_DE_ESCRITA_FORA_DO_PLANO, RECUSA_DE_PLANO, type MensagemDoModelo } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { anunciaMudanca, escolhaDaSegundaChance, recusouEscrita, recusouPlano } from "./anuncio.js";

describe("anunciaMudanca", () => {
  it("pega a promessa que apareceu em produção", () => {
    expect(
      anunciaMudanca(
        "Posso organizar isso, mas preciso propor o plano antes de mudar. Vou criar o grupo Família e as sessões Família Fonseca e Família Seixas dentro dele.",
      ),
    ).toBe(true);
  });

  it("pega as formas de anunciar, com ou sem acento e em qualquer caixa", () => {
    for (const texto of [
      "Vou lançar o mercado de hoje.",
      "VAMOS CRIAR a meta agora",
      "Preciso propor o plano primeiro.",
      "Proponho o seguinte: separar R$ 500.",
      "Vou agora cadastrar a sessão.",
      "Antes preciso propor um plano.",
    ]) {
      expect(anunciaMudanca(texto), texto).toBe(true);
    }
  });

  it("deixa passar resposta de conversa e de consulta", () => {
    for (const texto of [
      "Você tem 2 metas e a sobra do mês é R$ 1.935,90.",
      "Oi! Posso ajudar a organizar o seu financeiro.",
      "O aluguel vence dia 5 e é de R$ 1.500,00.",
      "Quer que eu crie o grupo Família?",
      "Posso organizar isso?",
      "Vou te explicar como a sobra é calculada.",
      "",
      "   ",
    ]) {
      expect(anunciaMudanca(texto), texto).toBe(false);
    }
  });
});

describe("recusouEscrita", () => {
  const recusa: MensagemDoModelo = {
    role: "tool",
    content: `${RECUSA_DE_ESCRITA_FORA_DO_PLANO} Chame propor_plano com este passo.`,
    toolCallId: "c1",
    nome: "criar_grupo",
    agente: "coordenador",
  };

  it("vale quando a última mensagem é a recusa do backend", () => {
    expect(recusouEscrita([{ role: "user", content: "Crie o grupo Família" }, recusa])).toBe(true);
  });

  it("não vale para outro resultado de ferramenta nem quando a recusa já ficou para trás", () => {
    const leitura: MensagemDoModelo = { role: "tool", content: "[]", toolCallId: "c2", nome: "listar_grupos_e_sessoes", agente: "coordenador" };
    expect(recusouEscrita([{ role: "user", content: "oi" }, leitura])).toBe(false);
    expect(recusouEscrita([recusa, { role: "assistant", content: "Vou propor.", agente: "coordenador" }])).toBe(false);
    expect(recusouEscrita([])).toBe(false);
  });
});

describe("promessas de consultar e revisar, como no turno de produção de 03/11", () => {
  it("pega as duas respostas que travaram o turno", () => {
    expect(
      anunciaMudanca("Certo — ainda faltam linhas de Uber/99 na conferência de outubro. Vou revisar a conferência inteira de outubro e te digo exatamente o que sobrou para lançar."),
    ).toBe(true);
    expect(
      anunciaMudanca("Preciso refazer o plano porque a conferência de outubro tem mais páginas do que o limite do cartão aceita num único plano. Vou dividir a revisão em blocos e te mostrar o próximo passo para aprovar."),
    ).toBe(true);
  });

  it("não confunde resposta final com promessa", () => {
    for (const texto of [
      "Feito: lancei as linhas de Uber e 99 de outubro. Isso aumentou as saídas em R$ 16,44.",
      "Você ainda tem 4 linhas sem lançamento em outubro: 2 da Uber e 2 da 99.",
      "Posso lançar isso se você aprovar.",
      "Vou te explicar como a sobra é calculada.",
    ]) {
      expect(anunciaMudanca(texto), texto).toBe(false);
    }
  });
});

describe("recusouPlano", () => {
  const recusa = (content: string, nome = "propor_plano"): MensagemDoModelo => ({
    role: "tool",
    content,
    toolCallId: "p1",
    nome,
    agente: "coordenador",
  });

  it("vale quando a última mensagem é o plano recusado pelo backend", () => {
    expect(recusouPlano([{ role: "user", content: "lance tudo" }, recusa(`Plano inválido: 25 passos. ${RECUSA_DE_PLANO}`)])).toBe(true);
  });

  it("não vale para outra ferramenta, para um resultado sem a marca nem quando a recusa ficou para trás", () => {
    expect(recusouPlano([recusa(`Plano inválido. ${RECUSA_DE_PLANO}`, "consultar_conferencia")])).toBe(false);
    expect(recusouPlano([recusa("A pessoa aprovou o plano.")])).toBe(false);
    expect(recusouPlano([recusa(`Plano inválido. ${RECUSA_DE_PLANO}`), { role: "assistant", content: "ok", agente: "coordenador" }])).toBe(false);
  });
});

describe("escolhaDaSegundaChance", () => {
  const recusaDePlano: MensagemDoModelo = {
    role: "tool",
    content: `Plano inválido. ${RECUSA_DE_PLANO}`,
    toolCallId: "p1",
    nome: "propor_plano",
    agente: "coordenador",
  };

  it("obriga o plano depois de uma recusa e quando o texto fala do plano", () => {
    expect(escolhaDaSegundaChance("Vou dividir em blocos.", [recusaDePlano])).toBe("propor_plano");
    expect(escolhaDaSegundaChance("Preciso propor o plano antes de mudar.", [])).toBe("propor_plano");
  });

  it("aceita qualquer ferramenta quando a promessa é de consultar", () => {
    expect(escolhaDaSegundaChance("Vou revisar a conferência inteira e te digo o que sobrou.", [])).toBe("any");
  });
});
