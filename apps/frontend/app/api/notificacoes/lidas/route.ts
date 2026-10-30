import { callBackend } from "../../_lib/backend";

export function POST() {
  return callBackend("notificacoes/lidas", { method: "POST" });
}
