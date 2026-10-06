import { callBackend } from "../_lib/backend";

export function GET() {
  return callBackend("grupos");
}

export async function POST(request: Request) {
  return callBackend("grupos", {
    method: "POST",
    body: await request.text(),
  });
}
