import { callBackend } from "../_lib/backend";

export function GET() {
  return callBackend("configuracoes");
}

export async function PUT(request: Request) {
  return callBackend("configuracoes", { method: "PUT", body: await request.text() });
}
