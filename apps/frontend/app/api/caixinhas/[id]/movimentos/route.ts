import { callBackend } from "../../../_lib/backend";

/** Rendimento, aplicação ou resgate na sessão da caixinha. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return Promise.all([context.params, request.text()]).then(([params, body]) =>
    callBackend(`caixinhas/${encodeURIComponent(params.id)}/movimentos`, { method: "POST", body }),
  );
}
