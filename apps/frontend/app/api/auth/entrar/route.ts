import { abrirSessao } from "../../_lib/acesso";

export function POST(request: Request) {
  return abrirSessao(request, "auth/entrar");
}
