import { callBackend } from "../../_lib/backend";

export function GET() {
  return callBackend("notificacoes/preferencias");
}

export function PUT(request: Request) {
  return request.text().then((body) => callBackend("notificacoes/preferencias", { method: "PUT", body }));
}
