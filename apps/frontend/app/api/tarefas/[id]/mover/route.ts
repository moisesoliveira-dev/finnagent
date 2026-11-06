import { callBackend } from "../../../_lib/backend";

export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return request.text().then((body) =>
    context.params.then((params) => callBackend(`tarefas/${params.id}/mover`, { method: "PATCH", body })),
  );
}
