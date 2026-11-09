import { callBackend } from "../../_lib/backend";

export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return Promise.all([context.params, request.text()]).then(([params, body]) =>
    callBackend(`caixinhas/${encodeURIComponent(params.id)}`, { method: "PATCH", body }),
  );
}

export function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return context.params.then((params) => callBackend(`caixinhas/${encodeURIComponent(params.id)}`, { method: "DELETE" }));
}
