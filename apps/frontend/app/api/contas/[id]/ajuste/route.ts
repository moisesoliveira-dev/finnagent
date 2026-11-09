import { callBackend } from "../../../_lib/backend";

/** "O banco mostra R$ X": lança a diferença como ajuste da conta. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return Promise.all([context.params, request.text()]).then(([params, body]) =>
    callBackend(`contas/${encodeURIComponent(params.id)}/ajuste`, { method: "POST", body }),
  );
}
