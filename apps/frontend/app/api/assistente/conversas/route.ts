import { callBackend } from "../../_lib/backend";

export function GET() {
  return callBackend("assistente/conversas");
}

export function DELETE() {
  return callBackend("assistente/conversas", { method: "DELETE" });
}
