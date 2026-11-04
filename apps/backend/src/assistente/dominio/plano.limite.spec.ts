import { LINHAS_MAXIMAS_DO_PLANO, PASSOS_MAXIMOS_DO_PLANO } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { mensagemDeLinhasDemais, mensagemDoPlanoGrande, validarPlano } from "./plano.js";

const passo = (indice: number) => ({ ferramenta: "criar_grupo", descricao: `Criar o grupo ${indice}`, args: { name: `Grupo ${indice}` } });
const plano = (quantos: number) => ({
  objetivo: "Organizar",
  entendimento: "Vários passos.",
  suposicoes: [],
  passos: Array.from({ length: quantos }, (_, i) => passo(i + 1)),
});

describe("plano grande demais", () => {
  it("recusa com uma mensagem que diz o que fazer, e não com o erro do esquema", () => {
    const resposta = validarPlano(plano(PASSOS_MAXIMOS_DO_PLANO + 5), () => "id");
    expect(typeof resposta).toBe("string");
    expect(resposta).toBe(mensagemDoPlanoGrande(PASSOS_MAXIMOS_DO_PLANO + 5));
    expect(String(resposta)).toContain("acumular_linhas");
    expect(String(resposta)).toContain(`máximo é ${PASSOS_MAXIMOS_DO_PLANO}`);
    expect(String(resposta)).not.toContain("Too big");
  });

  it("no limite não recusa pelo tamanho", () => {
    const resposta = validarPlano(plano(PASSOS_MAXIMOS_DO_PLANO), () => "id");
    expect(String(typeof resposta === "string" ? resposta : "")).not.toContain("máximo é");
  });

  it("recusa plano com mais linhas de extrato do que cabe, somando os passos acumular_linhas", () => {
    const linhas = (quantas: number, base: number) =>
      Array.from({ length: quantas }, (_, i) => ({
        statementId: "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a02",
        line: base + i,
        sessionId: "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a01",
      }));
    const comLinhas = (...lotes: number[]) => ({
      objetivo: "Lançar",
      entendimento: "Linhas únicas.",
      suposicoes: [],
      passos: lotes.map((quantas, i) => ({ ferramenta: "acumular_linhas", descricao: "Lançar", args: { items: linhas(quantas, i * 1000 + 1) } })),
    });
    expect(validarPlano(comLinhas(60, 60), () => "id")).toBe(mensagemDeLinhasDemais(120));
    expect(String(validarPlano(comLinhas(60, 40), () => "id"))).not.toContain("linhas de extrato");
    expect(LINHAS_MAXIMAS_DO_PLANO).toBe(100);
  });
});

