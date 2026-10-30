import { loginDispensado } from "@finnagent/contracts";
import { NextResponse, type NextRequest } from "next/server";

const PAGINAS_ABERTAS = ["/login", "/cadastro"];
const API_ABERTA = ["/api/auth/entrar", "/api/auth/cadastro"];
const METODOS_QUE_ALTERAM = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function temCookie(request: NextRequest) {
  return Boolean(request.cookies.get("__Host-prumo_sessao")?.value ?? request.cookies.get("prumo_sessao")?.value);
}

/** O app mobile entra com o token em Authorization: Bearer. O navegador nunca manda isso sozinho, então não há CSRF. */
function temBearer(request: NextRequest) {
  return /^bearer\s+\S+/i.test(request.headers.get("authorization") ?? "");
}

// As origens do webview do app (Android, iOS e o esquema local). O navegador comum nunca está na lista.
const ORIGENS_DO_APP = new Set(["https://localhost", "http://localhost", "capacitor://localhost"]);

/** O app pede com o cabeçalho próprio no login e com o Bearer depois. Cabeçalho próprio obriga o preflight, que só o app passa. */
function pedidoDoApp(request: NextRequest) {
  return !temCookie(request) && (temBearer(request) || request.headers.get("x-prumo-app") === "mobile");
}

function origemDoApp(request: NextRequest) {
  const origem = request.headers.get("origin");
  return origem && ORIGENS_DO_APP.has(origem) ? origem : null;
}

/** CORS só para o app: sem credenciais (não há cookie) e só com a origem exata. */
function comCors(request: NextRequest, resposta: NextResponse) {
  const origem = origemDoApp(request);
  if (origem && pedidoDoApp(request)) {
    resposta.headers.set("access-control-allow-origin", origem);
    resposta.headers.append("vary", "Origin");
  }
  return resposta;
}

/** Pedido que altera dado só vale se veio da própria origem. Complementa o SameSite=Lax do cookie. */
function mesmaOrigem(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origem = request.headers.get("origin");
  if (!origem) return true;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0]?.trim();
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

// Este portão só olha se existe cookie, para barrar rápido. Quem decide se a sessão vale é o backend.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const ehApi = pathname.startsWith("/api/");

  // O preflight do webview do app: responde sem passar pelo portão, só para as origens do app.
  const origem = origemDoApp(request);
  if (ehApi && request.method === "OPTIONS" && origem && request.headers.has("access-control-request-method")) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origem,
        "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE",
        "access-control-allow-headers": "authorization, content-type, x-prumo-app",
        "access-control-max-age": "600",
        vary: "Origin",
      },
    });
  }

  const doApp = ehApi && pedidoDoApp(request);

  if (ehApi && !doApp && METODOS_QUE_ALTERAM.has(request.method) && !mesmaOrigem(request)) {
    return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  }

  const aberta = ehApi ? API_ABERTA.includes(pathname) : PAGINAS_ABERTAS.includes(pathname);
  const logado = temCookie(request) || (doApp && temBearer(request));

  // Em desenvolvimento (APP_ENV=development, fora do Railway) o portão fica aberto; o backend decide o mesmo.
  if (!aberta && !logado && !loginDispensado(process.env)) {
    if (ehApi) return comCors(request, NextResponse.json({ message: "Entre para continuar." }, { status: 401 }));
    const destino = new URL("/login", request.url);
    if (pathname !== "/") destino.searchParams.set("proximo", `${pathname}${search}`);
    return NextResponse.redirect(destino);
  }

  if (!ehApi && aberta && logado && !request.nextUrl.searchParams.has("expirou")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return ehApi ? comCors(request, NextResponse.next()) : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
