import { RECUSA_DE_ESCRITA_FORA_DO_PLANO, type MensagemDoModelo } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { anunciaMudanca, recusouEscrita } from "./anuncio.js";

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
