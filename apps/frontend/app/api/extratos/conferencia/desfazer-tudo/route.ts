import { callBackend } from "../../../_lib/backend";

export function POST() {
  return callBackend("extratos/conferencia/desfazer-tudo", { method: "POST" });
}
