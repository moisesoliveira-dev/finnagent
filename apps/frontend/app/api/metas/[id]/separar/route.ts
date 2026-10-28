import { callBackend } from "../../../_lib/backend";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return Promise.all([context.params, request.text()]).then(([params, body]) =>
    callBackend(`metas/${encodeURIComponent(params.id)}/separar`, { method: "POST", body }),
  );
}
