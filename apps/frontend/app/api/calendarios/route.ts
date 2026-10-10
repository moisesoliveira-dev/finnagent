import { callBackend } from "../_lib/backend";

export function PATCH(request: Request) {
  return request.text().then((body) => callBackend("calendarios", { method: "PATCH", body }));
}
