import type { NomeAgenda } from "@finnagent/contracts";
import { ClienteGoogle, itensDe, paginaDe, pedirAoGoogle, texto } from "../../google/cliente-google.js";
import type { EventoGoogle } from "../dominio/sincronizar.js";

export function eventosDe(calendar: NomeAgenda, corpo: unknown): EventoGoogle[] {
  return itensDe(corpo).flatMap((item) => {
    const id = texto(item.id);
    const inicio = instante(item.start);
    const fim = instante(item.end);
    if (!id || !inicio || !fim) return [];
    return [
      {
        id,
        calendar,
        title: texto(item.summary),
        description: texto(item.description).slice(0, 2000),
        location: texto(item.location).slice(0, 160),
        startAt: inicio,
        endAt: fim,
        allDay: diaInteiro(item.start),
      },
    ];
  });
}

/** O cliente comum do Google, mais os eventos das agendas, que só a agenda lê. */
export class ClienteDaAgendaGoogle extends ClienteGoogle {
  async eventos(accessToken: string, calendar: NomeAgenda, calendarId: string) {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 30);
    const fim = new Date();
    fim.setDate(fim.getDate() + 180);
    const eventos: EventoGoogle[] = [];
    let page = "";
    for (let volta = 0; volta < 4; volta += 1) {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "250");
      url.searchParams.set("timeMin", inicio.toISOString());
      url.searchParams.set("timeMax", fim.toISOString());
      if (page) url.searchParams.set("pageToken", page);
      const corpo = await pedirAoGoogle(url, { headers: { authorization: `Bearer ${accessToken}` } });
      eventos.push(...eventosDe(calendar, corpo));
      page = paginaDe(corpo);
      if (!page) break;
    }
    return eventos;
  }
}

function instante(valor: unknown) {
  if (!valor || typeof valor !== "object") return "";
  const campo = valor as { dateTime?: unknown; date?: unknown };
  if (typeof campo.dateTime === "string" && campo.dateTime) return campo.dateTime;
  if (typeof campo.date === "string" && campo.date) return `${campo.date}T00:00:00`;
  return "";
}

function diaInteiro(valor: unknown) {
  if (!valor || typeof valor !== "object") return false;
  const campo = valor as { date?: unknown; dateTime?: unknown };
  return Boolean(texto(campo.date) && !texto(campo.dateTime));
}
