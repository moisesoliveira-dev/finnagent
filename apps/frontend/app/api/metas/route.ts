import { callBackend } from "../_lib/backend";

export function GET() {
  return callBackend("metas");
}

export function POST(request: Request) {
  return request.text().then((body) => callBackend("metas", { method: "POST", body }));
}
