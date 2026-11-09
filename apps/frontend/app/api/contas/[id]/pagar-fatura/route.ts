import { callBackend } from "../../../_lib/backend";

/** Paga a fatura a partir de uma conta: o par de transferências. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return Promise.all([context.params, request.text()]).then(([params, body]) =>
    callBackend(`contas/${encodeURIComponent(params.id)}/pagar-fatura`, { method: "POST", body }),
  );
}
