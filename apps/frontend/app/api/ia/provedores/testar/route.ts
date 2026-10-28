import { callBackend } from "../../../_lib/backend";

export async function POST(request: Request) {
  return callBackend("ia/provedores/testar", { method: "POST", body: await request.text() });
}
