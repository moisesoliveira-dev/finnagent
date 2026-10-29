import { describe, expect, it } from "vitest";
import { semOpcaoGenerica } from "./opcoes.js";

const opcao = (rotulo: string) => ({ rotulo });

describe("semOpcaoGenerica", () => {
  it("tira os botões que só pedem outra resposta", () => {
    const lista = ["Sim, dia 15", "Outra regra", "Escolher outro nome", "Outra resposta", "Outro"].map(opcao);
    expect(semOpcaoGenerica(lista)).toEqual([opcao("Sim, dia 15")]);
  });

  it("mantém opções concretas que citam outro dia ou outro nome", () => {
    const lista = ["A quinzena é outro dia", "Criar Renda · Salário", "Outro mês: novembro"].map(opcao);
    expect(semOpcaoGenerica(lista)).toEqual(lista);
  });
});
