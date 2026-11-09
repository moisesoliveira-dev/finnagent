import { callBackend } from "../../_lib/backend";

/** A linha do extrato é uma transferência com outra conta da pessoa. */
export async function POST(request: Request) {
  return callBackend("extratos/transferir", { method: "POST", body: await request.text() });
}
