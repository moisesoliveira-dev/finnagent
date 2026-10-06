import { callBackend } from "../_lib/backend";

export async function POST(request: Request) {
  return callBackend("sessoes", {
    method: "POST",
    body: await request.text(),
  });
}
