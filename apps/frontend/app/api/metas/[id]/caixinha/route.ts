import { callBackend } from "../../../_lib/backend";

/** Liga a meta a uma caixinha, ou desfaz com boxId null. */
export function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return Promise.all([context.params, request.text()]).then(([params, body]) =>
    callBackend(`metas/${encodeURIComponent(params.id)}/caixinha`, { method: "PUT", body }),
  );
}
