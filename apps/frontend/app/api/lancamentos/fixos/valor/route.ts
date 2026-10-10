import { callBackend } from "../../../_lib/backend";

export async function POST(request: Request) {
  return callBackend("lancamentos/fixos/valor", {
    method: "POST",
    body: await request.text(),
  });
}
