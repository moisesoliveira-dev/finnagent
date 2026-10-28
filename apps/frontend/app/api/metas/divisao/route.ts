import { callBackend } from "../../_lib/backend";

export function PUT(request: Request) {
  return request.text().then((body) => callBackend("metas/divisao", { method: "PUT", body }));
}
