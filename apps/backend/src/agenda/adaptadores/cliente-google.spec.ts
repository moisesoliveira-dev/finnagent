import { eventosDe, refreshDe } from "./cliente-google.js";

describe("cliente do Google", () => {
  it("lê o refresh token e os eventos", () => {
    expect(refreshDe({ refresh_token: "abc" })).toBe("abc");
    expect(refreshDe({})).toBe("");
    expect(
      eventosDe("Pessoal", {
        items: [
          {
            id: "ev-1",
            summary: "Consulta",
            start: { date: "2026-04-01" },
            end: { date: "2026-04-02" },
          },
          { summary: "sem id" },
        ],
      }),
    ).toEqual([
      {
        id: "ev-1",
        calendar: "Pessoal",
        title: "Consulta",
        description: "",
        location: "",
        startAt: "2026-04-01T00:00:00",
        endAt: "2026-04-02T00:00:00",
        allDay: true,
      },
    ]);
  });
});
