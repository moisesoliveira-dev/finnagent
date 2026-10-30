import { callBackend } from "../_lib/backend";

export function GET(request: Request) {
  const antes = new URL(request.url).searchParams.get("antes") ?? "";
  return callBackend(antes ? `notificacoes?antes=${encodeURIComponent(antes)}` : "notificacoes");
}
