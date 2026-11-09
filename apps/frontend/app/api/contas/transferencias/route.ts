import { callBackend } from "../../_lib/backend";

/** Transfere entre duas contas: os dois lados da transferência. */
export async function POST(request: Request) {
  return callBackend("contas/transferencias", { method: "POST", body: await request.text() });
}
