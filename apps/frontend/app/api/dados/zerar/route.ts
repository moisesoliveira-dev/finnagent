import { callBackend } from "../../_lib/backend";

export function POST() {
  return callBackend("dados/zerar", { method: "POST" });
}
