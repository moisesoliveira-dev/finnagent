import { callBackend } from "../../../_lib/backend";

export function POST() {
  return callBackend("configuracoes/google/desconectar", { method: "POST", body: "{}" });
}
