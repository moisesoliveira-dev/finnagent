import { callBackend } from "../../../_lib/backend";

export function POST(request: Request) {
  return request.text().then((body) => callBackend("notificacoes/dispositivos/remover", { method: "POST", body }));
}
