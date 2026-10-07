import { callBackend } from "../../_lib/backend";

export function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return context.params.then((params) => callBackend(`extratos/${params.id}`, { method: "DELETE" }));
}
