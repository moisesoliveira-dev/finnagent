import { cookies, headers } from "next/headers";

// Em https o cookie leva o prefixo __Host-: o navegador só o aceita com Secure, Path=/ e sem Domain.
export const COOKIE_SEGURO = "__Host-prumo_sessao";
export const COOKIE_LOCAL = "prumo_sessao";

/** O app mobile não tem cookie: manda o token da sessão em Authorization: Bearer. */
export function tokenDoCabecalho(authorization: string | null) {
  const [tipo, token] = (authorization ?? "").split(" ");
  return tipo?.toLowerCase() === "bearer" && token ? token : "";
}

export async function lerToken() {
  const jar = await cookies();
  const doCookie = jar.get(COOKIE_SEGURO)?.value ?? jar.get(COOKIE_LOCAL)?.value;
  if (doCookie) return doCookie;
  return tokenDoCabecalho((await headers()).get("authorization"));
}

export function opcoesDoCookie(seguro: boolean, expira: Date) {
  return {
    name: seguro ? COOKIE_SEGURO : COOKIE_LOCAL,
    httpOnly: true,
    secure: seguro,
    sameSite: "lax" as const,
    path: "/",
    expires: expira,
  };
}

/** Apaga o cookie nas duas grafias, para não sobrar um de quando o site rodava em http. */
export function limparCookies(headers: Headers) {
  headers.append("set-cookie", `${COOKIE_LOCAL}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  headers.append("set-cookie", `${COOKIE_SEGURO}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`);
}
