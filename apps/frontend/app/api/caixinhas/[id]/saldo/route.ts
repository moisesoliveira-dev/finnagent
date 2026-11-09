import { callBackend } from "../../../_lib/backend";

/** "A caixinha mostra R$ X": a diferença vira rendimento ou perda. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return Promise.all([context.params, request.text()]).then(([params, body]) =>
    callBackend(`caixinhas/${encodeURIComponent(params.id)}/saldo`, { method: "POST", body }),
  );
}
