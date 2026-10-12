import { montarVirada, sessoesEncerradas } from "./virada.js";

const grupos = [
  {
    id: "g1",
    name: "Moradia",
    sessions: [
      { id: "s1", name: "Aluguel" },
      { id: "s2", name: "Condomínio" },
    ],
  },
];

describe("virada do ano", () => {
  it("não pergunta no ano do workflow", () => {
    expect(montarVirada({ year: 2026, month: 12, day: 31 }, 2026, false, grupos)).toEqual({
      pendente: false,
    });
  });

  it("pergunta a partir de janeiro do ano seguinte, até decidir", () => {
    expect(montarVirada({ year: 2027, month: 1, day: 1 }, 2026, false, grupos)).toEqual({
      pendente: true,
      year: 2027,
      groups: grupos,
    });
    expect(montarVirada({ year: 2027, month: 6, day: 2 }, 2026, true, grupos)).toEqual({
      pendente: false,
    });
  });

  it("encerra sessão fora da escolha e a sessão de grupo que não permanece", () => {
    expect(sessoesEncerradas(grupos, ["g1"], ["s1"])).toEqual(["s2"]);
    expect(sessoesEncerradas(grupos, [], ["s1", "s2"])).toEqual(["s1", "s2"]);
  });
});
