import { callBackend } from "../../_lib/backend";

const FILTROS = ["year", "month", "day", "groupId", "category", "q"];

export function GET(request: Request) {
  const origem = new URL(request.url).searchParams;
  const destino = new URLSearchParams();
  for (const nome of FILTROS) {
    const valor = origem.get(nome);
    if (valor) destino.set(nome, valor);
  }
  return callBackend(`financas/base?${destino.toString()}`);
}
