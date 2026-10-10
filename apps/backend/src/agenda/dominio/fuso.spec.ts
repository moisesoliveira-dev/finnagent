import { instanteNoFuso, montarIntervalo, partesNoFuso } from "./fuso.js";

describe("fuso do calendário", () => {
  it("guarda 9h em Brasília como meio-dia UTC", () => {
    const inicio = instanteNoFuso(2026, 10, 7, 9, 0, "America/Sao_Paulo");
    expect(inicio.toISOString()).toBe("2026-10-07T12:00:00.000Z");
    expect(partesNoFuso(inicio, "America/Sao_Paulo")).toEqual({
      year: 2026,
      month: 10,
      day: 7,
      hour: 9,
      minute: 0,
    });
  });

  it("trata o dia todo como o dia local inteiro", () => {
    const intervalo = montarIntervalo({
      allDay: true,
      year: 2026,
      month: 10,
      day: 7,
      time: null,
      endTime: null,
      timezone: "America/Sao_Paulo",
    });
    expect(intervalo).toMatchObject({ hour: null, minute: null });
    if (intervalo === "hora" || intervalo === "ordem") return;
    expect(partesNoFuso(intervalo.startAt, "America/Sao_Paulo").hour).toBe(0);
    expect(partesNoFuso(intervalo.endAt, "America/Sao_Paulo")).toMatchObject({ hour: 23, minute: 59 });
  });

  it("recusa hora final anterior à inicial", () => {
    expect(
      montarIntervalo({
        allDay: false,
        year: 2026,
        month: 10,
        day: 7,
        time: "10:00",
        endTime: "09:00",
        timezone: "UTC",
      }),
    ).toBe("ordem");
  });
});
