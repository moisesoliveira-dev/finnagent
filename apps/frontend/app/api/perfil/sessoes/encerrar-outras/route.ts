import { callBackend } from "../../../_lib/backend";

export function POST() {
  return callBackend("perfil/sessoes/encerrar-outras", { method: "POST" });
}
