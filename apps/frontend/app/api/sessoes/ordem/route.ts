import { callBackend } from "../../_lib/backend";

export function PUT(request: Request) {
  return request.text().then((body) => callBackend("sessoes/ordem", { method: "PUT", body }));
}
