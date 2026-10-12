import { callBackend } from "../../_lib/backend";

export function GET() {
  return callBackend("grupos/virada");
}

export async function POST(request: Request) {
  return callBackend("grupos/virada", {
    method: "POST",
    body: await request.text(),
  });
}
