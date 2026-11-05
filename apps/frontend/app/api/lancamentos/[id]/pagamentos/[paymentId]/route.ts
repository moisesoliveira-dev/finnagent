import { callBackend } from "../../../../_lib/backend";

export function DELETE(_request: Request, context: { params: Promise<{ id: string; paymentId: string }> }) {
  return context.params.then((params) =>
    callBackend(`lancamentos/${params.id}/pagamentos/${params.paymentId}`, { method: "DELETE" }),
  );
}
