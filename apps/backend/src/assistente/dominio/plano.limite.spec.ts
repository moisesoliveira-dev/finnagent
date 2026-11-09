import { LINHAS_MAXIMAS_DO_PLANO, PASSOS_MAXIMOS_DO_PLANO } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { mensagemDeLinhasDemais, mensagemDoPlanoGrande, normalizarArgs, validarPlano } from "./plano.js";

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
    const texto = resposta as string;
    expect(texto).toContain("acumular_linhas");
    expect(texto).toContain(`máximo é ${PASSOS_MAXIMOS_DO_PLANO}`);
    expect(texto).not.toContain("Too big");
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
    expect(JSON.stringify(validarPlano(comLinhas(60, 40), () => "id"))).not.toContain("linhas de extrato");
    expect(LINHAS_MAXIMAS_DO_PLANO).toBe(100);
  });
});

describe("a lista de linhas com outro nome", () => {
  const linha = { statementId: "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a02", line: 1, sessionId: "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a01" };

  it("vira items antes de validar, para o plano não ser recusado por isso", () => {
    expect(normalizarArgs("acumular_linhas", { linhas: [linha] })).toEqual({ items: [linha] });
    expect(normalizarArgs("acumular_linhas", { lines: [linha] })).toEqual({ items: [linha] });
    expect(normalizarArgs("acumular_linhas", { items: [linha], linhas: [] })).toEqual({ items: [linha], linhas: [] });
    expect(normalizarArgs("criar_grupo", { linhas: [linha] })).toEqual({ linhas: [linha] });
    const plano = validarPlano(
      { objetivo: "Lançar", entendimento: "Linhas únicas.", suposicoes: [], passos: [{ ferramenta: "acumular_linhas", descricao: "Lançar", args: { linhas: [linha] } }] },
      () => "id",
    );
    expect(typeof plano).toBe("object");
    expect((plano as { passos: { args: unknown }[] }).passos[0]?.args).toEqual({ items: [linha] });
  });
});

