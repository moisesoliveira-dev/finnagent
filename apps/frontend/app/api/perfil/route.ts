import { callBackend } from "../_lib/backend";

export function GET() {
  return callBackend("perfil");
}

export function PATCH(request: Request) {
  return request.text().then((body) => callBackend("perfil", { method: "PATCH", body }));
}
