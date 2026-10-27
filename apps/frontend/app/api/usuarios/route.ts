import { callBackend } from "../_lib/backend";

export function GET() {
  return callBackend("usuarios");
}

export function POST(request: Request) {
  return request.text().then((body) => callBackend("usuarios", { method: "POST", body }));
}
