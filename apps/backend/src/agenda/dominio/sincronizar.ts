import type { NomeAgenda } from "@finnagent/contracts";

export type EventoGoogle = {
  id: string;
  calendar: NomeAgenda;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
};

export function eventoValido(evento: EventoGoogle) {
  const inicio = new Date(evento.startAt);
  const fim = new Date(evento.endAt);
  return !Number.isNaN(inicio.getTime()) && !Number.isNaN(fim.getTime()) && fim.getTime() > inicio.getTime();
}
