import type { NomeAgenda } from "@finnagent/contracts";
import type { EventoGoogle } from "../dominio/sincronizar.js";

export class FalhaGoogle extends Error {
  constructor() {
    super("Não foi possível falar com o Google Calendar.");
  }
}

export function accessDe(corpo: unknown) {
  return textoDe(corpo, "access_token");
}

export function refreshDe(corpo: unknown) {
  return textoDe(corpo, "refresh_token");
}

export function agendasDe(corpo: unknown) {
  const itens = itensDe(corpo);
  return itens.flatMap((item) => {
    const id = texto(item.id);
    if (!id) return [];
    return [{ id, name: texto(item.summary) || id, primary: item.primary === true }];
  });
}

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

export function paginaDe(corpo: unknown) {
  if (!corpo || typeof corpo !== "object" || !("nextPageToken" in corpo)) return "";
  return texto((corpo as { nextPageToken?: unknown }).nextPageToken);
}

export class ClienteGoogle {
  async trocarCodigo(pedido: { clientId: string; clientSecret: string; code: string; redirectUri: string }) {
    const corpo = await pedir("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: pedido.clientId,
        client_secret: pedido.clientSecret,
        code: pedido.code,
        grant_type: "authorization_code",
        redirect_uri: pedido.redirectUri,
      }),
    });
    return { accessToken: accessDe(corpo), refreshToken: refreshDe(corpo) };
  }

  async accessToken(pedido: { clientId: string; clientSecret: string; refreshToken: string }) {
    const corpo = await pedir("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: pedido.clientId,
        client_secret: pedido.clientSecret,
        refresh_token: pedido.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const accessToken = accessDe(corpo);
    if (!accessToken) throw new FalhaGoogle();
    return accessToken;
  }

  async agendas(accessToken: string) {
    const corpo = await pedir("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return agendasDe(corpo);
  }

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
      const corpo = await pedir(url, { headers: { authorization: `Bearer ${accessToken}` } });
      eventos.push(...eventosDe(calendar, corpo));
      page = paginaDe(corpo);
      if (!page) break;
    }
    return eventos;
  }
}

async function pedir(url: string | URL, init: RequestInit) {
  let resposta: Response;
  try {
    resposta = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new FalhaGoogle();
  }
  const texto = await resposta.text();
  if (!resposta.ok) throw new FalhaGoogle();
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new FalhaGoogle();
  }
}

function textoDe(corpo: unknown, campo: string) {
  if (!corpo || typeof corpo !== "object" || !(campo in corpo)) return "";
  return texto((corpo as Record<string, unknown>)[campo]);
}

function itensDe(corpo: unknown) {
  if (!corpo || typeof corpo !== "object" || !("items" in corpo)) return [];
  const items = (corpo as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
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
