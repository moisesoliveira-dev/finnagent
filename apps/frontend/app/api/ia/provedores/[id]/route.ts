import { callBackend } from "../../../_lib/backend";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Contexto) {
  const params = await context.params;
  return callBackend(`ia/provedores/${encodeURIComponent(params.id)}`, { method: "PATCH", body: await request.text() });
}

export function DELETE(_request: Request, context: Contexto) {
  return context.params.then((params) => callBackend(`ia/provedores/${encodeURIComponent(params.id)}`, { method: "DELETE" }));
}
