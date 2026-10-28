import { callBackend } from "../_lib/backend";

const FILTROS = ["pagina", "categoria", "status", "q", "dia"];

export function GET(request: Request) {
  const origem = new URL(request.url).searchParams;
  const destino = new URLSearchParams();
  for (const nome of FILTROS) {
    const valor = origem.get(nome);
    if (valor) destino.set(nome, valor);
  }
  return callBackend(`eventos?${destino.toString()}`);
}
