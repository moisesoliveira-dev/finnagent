import { callBackend } from "../../_lib/backend";

export function POST() {
  return callBackend("agenda/sincronizar", { method: "POST", body: "{}" });
}
