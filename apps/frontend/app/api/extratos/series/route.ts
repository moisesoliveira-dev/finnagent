import { callBackend } from "../../_lib/backend";

export function GET() {
  return callBackend("extratos/series");
}

export function POST(request: Request) {
  return request.text().then((body) => callBackend("extratos/series", { method: "POST", body }));
}
