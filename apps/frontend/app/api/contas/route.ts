import { callBackend } from "../_lib/backend";

export function GET() {
  return callBackend("contas");
}

export async function POST(request: Request) {
  return callBackend("contas", { method: "POST", body: await request.text() });
}
