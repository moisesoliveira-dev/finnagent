import type { SessaoAberta } from "@finnagent/contracts";
import { NextResponse } from "next/server";
import { origemPublica } from "./origem";
import { opcoesDoCookie } from "./sessao";

/**
 * IP de quem chamou, para o limite de tentativas do backend. O último valor do
 * X-Forwarded-For é o que a borda do Railway acrescentou; o primeiro o cliente pode forjar.
 */
function ipDe(request: Request) {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const lista = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  return lista[lista.length - 1]?.trim() || "desconhecido";
}

/**
 * Cadastro e entrada: chama o backend, guarda o token só no cookie httpOnly e devolve
 * ao navegador apenas o usuário. O token nunca passa por JavaScript da página.
 */
export async function abrirSessao(request: Request, caminho: "auth/entrar" | "auth/cadastro") {
  const base = process.env.API_URL;
  if (!base) return Response.json({ message: "API_URL não está definida." }, { status: 503 });

  let corpo: string;
  try {
    corpo = JSON.stringify(await request.json());
  } catch {
    return Response.json({ message: "Pedido inválido." }, { status: 400 });
  }

  let resposta: Response;
  try {
    resposta = await fetch(new URL(caminho, base.endsWith("/") ? base : `${base}/`), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": request.headers.get("user-agent") ?? "",
        "x-client-ip": ipDe(request),
      },
      body: corpo,
      cache: "no-store",
    });
  } catch {
    return Response.json({ message: "O backend não respondeu." }, { status: 503 });
  }

  const texto = await resposta.text();
  if (!resposta.ok) {
    const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
    const espera = resposta.headers.get("retry-after");
    if (espera) headers.set("retry-after", espera);
    return new Response(texto, { status: resposta.status, headers });
  }

  const aberta = JSON.parse(texto) as SessaoAberta;
  const seguro = origemPublica(request).startsWith("https://");
  const saida = NextResponse.json({ user: aberta.user }, { headers: { "cache-control": "no-store" } });
  saida.cookies.set({ ...opcoesDoCookie(seguro, new Date(aberta.expiresAt)), value: aberta.token });
  return saida;
}
