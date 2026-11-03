import { PASSOS_MAXIMOS_DO_PLANO } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { mensagemDoPlanoGrande, validarPlano } from "./plano.js";

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
});
