import { callBackend } from "../../_lib/backend";

export function POST(request: Request) {
  return request.text().then((body) => callBackend("extratos/previa", { method: "POST", body }));
}
