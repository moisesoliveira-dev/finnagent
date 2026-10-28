import { callBackend } from "../../_lib/backend";

const FILTROS = ["pagina", "resultado", "q"];

export function GET(request: Request) {
  const origem = new URL(request.url).searchParams;
  const destino = new URLSearchParams();
  for (const nome of FILTROS) {
    const valor = origem.get(nome);
    if (valor) destino.set(nome, valor);
  }
  return callBackend(`eventos/historico?${destino.toString()}`);
}
