import { eventoValido, type EventoGoogle } from "./sincronizar.js";

const evento: EventoGoogle = {
  id: "google-1",
  calendar: "Pessoal",
  title: "Reunião",
  description: "",
  location: "Sala 2",
  startAt: "2026-10-07T12:00:00.000Z",
  endAt: "2026-10-07T13:00:00.000Z",
  allDay: false,
};

describe("sincronização do Google", () => {
  it("aceita um intervalo com fim depois do início", () => {
    expect(eventoValido(evento)).toBe(true);
  });

  it("recusa fim anterior ou igual ao início", () => {
    expect(eventoValido({ ...evento, endAt: evento.startAt })).toBe(false);
    expect(eventoValido({ ...evento, startAt: "não é data" })).toBe(false);
  });
});
