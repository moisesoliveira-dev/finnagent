import { callBackend } from "../_lib/backend";

export function GET() {
  return callBackend("extratos");
}

export function POST(request: Request) {
  return request.text().then((body) => callBackend("extratos", { method: "POST", body }));
}
