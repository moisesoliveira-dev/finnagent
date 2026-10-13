const ESCOPO = "https://www.googleapis.com/auth/calendar.readonly";

export function redirectPermitido(valor: string) {
  try {
    const url = new URL(valor);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.pathname === "/api/configuracoes/google/retorno" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

export function urlDeAutorizacao(clienteId: string, redirectUri: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clienteId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ESCOPO);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}
