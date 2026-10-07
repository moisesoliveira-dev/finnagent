import type { Compromisso } from "@finnagent/contracts";
import { mensagemDaCategoria, ocorrenciasNoMes } from "./ocorrencias.js";

function definicao(parcial: Partial<Compromisso> = {}): Compromisso {
  return {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    title: "Aluguel",
    year: 2026,
    month: 10,
    day: 7,
    time: null,
    calendar: "Pessoal",
    category: "unico",
    endYear: null,
    endMonth: null,
    endDay: null,
    entryId: null,
    link: null,
    ...parcial,
  };
}

describe("ocorrências do compromisso", () => {
  it("mostra o único só no dia marcado", () => {
    expect(ocorrenciasNoMes(definicao(), 2026, 10).map((item) => item.day)).toEqual([7]);
    expect(ocorrenciasNoMes(definicao(), 2026, 11)).toEqual([]);
  });

  it("repete o recorrente no mesmo dia até dezembro do ano de início", () => {
    const serie = definicao({ category: "recorrente" });
    expect(ocorrenciasNoMes(serie, 2026, 9)).toEqual([]);
    expect(ocorrenciasNoMes(serie, 2026, 10).map((item) => item.day)).toEqual([7]);
    expect(ocorrenciasNoMes(serie, 2026, 12).map((item) => item.day)).toEqual([7]);
    expect(ocorrenciasNoMes(serie, 2027, 1)).toEqual([]);
  });

  it("encosta o recorrente do dia 31 no último dia do mês curto", () => {
    const serie = definicao({ category: "recorrente", month: 1, day: 31 });
    expect(ocorrenciasNoMes(serie, 2026, 2).map((item) => item.day)).toEqual([28]);
  });

  it("mostra a validade em cada dia do período, inclusive na virada do mês", () => {
    const serie = definicao({
      category: "validade",
      day: 30,
      endYear: 2026,
      endMonth: 11,
      endDay: 2,
    });
    expect(ocorrenciasNoMes(serie, 2026, 10).map((item) => item.day)).toEqual([30, 31]);
    expect(ocorrenciasNoMes(serie, 2026, 11).map((item) => item.day)).toEqual([1, 2]);
    expect(ocorrenciasNoMes(serie, 2026, 12)).toEqual([]);
  });

  it("recusa recorrente fora do ano atual e validade que termina antes", () => {
    expect(mensagemDaCategoria(definicao({ category: "recorrente", year: 2027 }), 2026)).toBe(
      "O recorrente fica só no ano atual.",
    );
    expect(
      mensagemDaCategoria(
        definicao({ category: "validade", endYear: 2026, endMonth: 10, endDay: 1 }),
        2026,
      ),
    ).toBe("A validade termina depois do início.");
    expect(mensagemDaCategoria(definicao({ category: "validade" }), 2026)).toBe(
      "Informe o fim da validade.",
    );
  });
});
