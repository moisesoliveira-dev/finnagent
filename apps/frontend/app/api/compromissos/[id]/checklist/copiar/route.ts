import { callBackend } from "../../../../_lib/backend";

/** Traz para o dia o checklist da última vez do compromisso que repete. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return Promise.all([context.params, request.text()]).then(([params, body]) =>
    callBackend(`compromissos/${encodeURIComponent(params.id)}/checklist/copiar`, { method: "POST", body }),
  );
}
