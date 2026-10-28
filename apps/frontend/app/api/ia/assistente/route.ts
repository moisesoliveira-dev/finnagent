import { callBackend } from "../../_lib/backend";

export async function PUT(request: Request) {
  return callBackend("ia/assistente", { method: "PUT", body: await request.text() });
}
