import { NextResponse, type NextRequest } from "next/server";

const PAGINAS_ABERTAS = ["/login", "/cadastro"];
const API_ABERTA = ["/api/auth/entrar", "/api/auth/cadastro"];
const METODOS_QUE_ALTERAM = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function temCookie(request: NextRequest) {
  return Boolean(request.cookies.get("__Host-prumo_sessao")?.value ?? request.cookies.get("prumo_sessao")?.value);
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

  if (ehApi && METODOS_QUE_ALTERAM.has(request.method) && !mesmaOrigem(request)) {
    return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  }

  const aberta = ehApi ? API_ABERTA.includes(pathname) : PAGINAS_ABERTAS.includes(pathname);
  const logado = temCookie(request);

  if (!aberta && !logado) {
    if (ehApi) return NextResponse.json({ message: "Entre para continuar." }, { status: 401 });
    const destino = new URL("/login", request.url);
    if (pathname !== "/") destino.searchParams.set("proximo", `${pathname}${search}`);
    return NextResponse.redirect(destino);
  }

  if (!ehApi && aberta && logado && !request.nextUrl.searchParams.has("expirou")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
