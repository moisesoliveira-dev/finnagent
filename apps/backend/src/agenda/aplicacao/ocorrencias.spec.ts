import type { Compromisso } from "@finnagent/contracts";
import { comValidade, mensagemDaCategoria, ocorrenciasNoMes, validadeAoMover } from "./ocorrencias.js";

function definicao(parcial: Partial<Compromisso> = {}): Compromisso {
  return {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    title: "Aluguel",
    description: "",
    location: "",
    startAt: "2026-10-07T03:00:00.000Z",
    endAt: "2026-10-08T02:59:00.000Z",
    allDay: true,
    status: "undone",
    year: 2026,
    month: 10,
    day: 7,
    time: null,
    calendar: "Pessoal",
    timezone: "America/Sao_Paulo",
    category: "fixed",
    endYear: null,
    endMonth: null,
    endDay: null,
    entryId: null,
    link: null,
    ...parcial,
  };
}

describe("ocorrências do compromisso", () => {
  it("mostra o fixo só no dia marcado", () => {
    expect(ocorrenciasNoMes(definicao(), 2026, 10).map((item) => item.day)).toEqual([7]);
    expect(ocorrenciasNoMes(definicao(), 2026, 11)).toEqual([]);
  });

  it("repete o periódico no mesmo dia, também no ano seguinte", () => {
    const serie = definicao({ category: "periodical" });
    expect(ocorrenciasNoMes(serie, 2026, 9)).toEqual([]);
    expect(ocorrenciasNoMes(serie, 2026, 10).map((item) => item.day)).toEqual([7]);
    expect(ocorrenciasNoMes(serie, 2026, 12).map((item) => item.day)).toEqual([7]);
    expect(ocorrenciasNoMes(serie, 2027, 1).map((item) => item.day)).toEqual([7]);
    expect(ocorrenciasNoMes(serie, 2026, 12)[0]).toMatchObject({
      anchorYear: 2026,
      anchorMonth: 10,
      anchorDay: 7,
    });
  });

  it("encosta o periódico do dia 31 no último dia do mês curto", () => {
    const serie = definicao({ category: "periodical", month: 1, day: 31 });
    expect(ocorrenciasNoMes(serie, 2026, 2).map((item) => item.day)).toEqual([28]);
  });

  it("repete o com validade no mesmo dia até o fim", () => {
    const serie = definicao({
      category: "time",
      endYear: 2026,
      endMonth: 12,
      endDay: 20,
    });
    expect(ocorrenciasNoMes(serie, 2026, 10).map((item) => item.day)).toEqual([7]);
    expect(ocorrenciasNoMes(serie, 2026, 12).map((item) => item.day)).toEqual([7]);
    expect(ocorrenciasNoMes(serie, 2027, 1)).toEqual([]);
  });

  it("não inclui o mês cuja data cai depois da validade", () => {
    const serie = definicao({
      category: "time",
      day: 30,
      endYear: 2026,
      endMonth: 11,
      endDay: 2,
    });
    expect(ocorrenciasNoMes(serie, 2026, 10).map((item) => item.day)).toEqual([30]);
    expect(ocorrenciasNoMes(serie, 2026, 11)).toEqual([]);
  });

  it("recusa validade que termina antes e periódico com data final", () => {
    expect(
      mensagemDaCategoria(definicao({ category: "time", endYear: 2026, endMonth: 10, endDay: 1 })),
    ).toBe("A validade termina depois do início.");
    expect(mensagemDaCategoria(definicao({ category: "time" }))).toBe("Informe o fim da validade.");
    expect(
      mensagemDaCategoria(definicao({ category: "periodical", endYear: 2026, endMonth: 12, endDay: 1 })),
    ).toBe("O periódico não tem validade.");
  });

  it("descarta a validade de quem não é com validade", () => {
    const fim = { endYear: 2026, endMonth: 12, endDay: 1 };
    expect(comValidade(definicao({ category: "periodical", ...fim }))).toMatchObject({
      endYear: null,
      endMonth: null,
      endDay: null,
    });
    expect(comValidade(definicao({ category: "time", ...fim }))).toMatchObject(fim);
  });

  it("empurra a validade quando o compromisso é movido para depois do fim", () => {
    const serie = definicao({ category: "time", endYear: 2026, endMonth: 11, endDay: 2 });
    expect(validadeAoMover(serie, { year: 2026, month: 11, day: 20 })).toEqual({
      endYear: 2026,
      endMonth: 11,
      endDay: 20,
    });
    expect(validadeAoMover(serie, { year: 2026, month: 10, day: 9 })).toEqual({
      endYear: 2026,
      endMonth: 11,
      endDay: 2,
    });
    expect(validadeAoMover(definicao(), { year: 2026, month: 10, day: 9 })).toEqual({
      endYear: null,
      endMonth: null,
      endDay: null,
    });
  });
});
