// O cliente HTTP do Google, comum às slices: as configurações trocam o código do OAuth e listam as agendas; a agenda
// renova o token e lê os eventos (em `agenda/adaptadores/cliente-google.ts`).

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

export function paginaDe(corpo: unknown) {
  if (!corpo || typeof corpo !== "object" || !("nextPageToken" in corpo)) return "";
  return texto((corpo as { nextPageToken?: unknown }).nextPageToken);
}

export class ClienteGoogle {
  async trocarCodigo(pedido: { clientId: string; clientSecret: string; code: string; redirectUri: string }) {
    const corpo = await pedirAoGoogle("https://oauth2.googleapis.com/token", {
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
    const corpo = await pedirAoGoogle("https://oauth2.googleapis.com/token", {
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
    const corpo = await pedirAoGoogle("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return agendasDe(corpo);
  }
}

export async function pedirAoGoogle(url: string | URL, init: RequestInit) {
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

export function itensDe(corpo: unknown) {
  if (!corpo || typeof corpo !== "object" || !("items" in corpo)) return [];
  const items = (corpo as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

export function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function textoDe(corpo: unknown, campo: string) {
  if (!corpo || typeof corpo !== "object" || !(campo in corpo)) return "";
  return texto((corpo as Record<string, unknown>)[campo]);
}
