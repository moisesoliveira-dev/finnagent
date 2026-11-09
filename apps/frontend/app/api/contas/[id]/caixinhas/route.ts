import { callBackend } from "../../../_lib/backend";

/** Cria uma caixinha na conta. A sessão do rendimento nasce junto, no grupo Conta. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return Promise.all([context.params, request.text()]).then(([params, body]) =>
    callBackend(`contas/${encodeURIComponent(params.id)}/caixinhas`, { method: "POST", body }),
  );
}
