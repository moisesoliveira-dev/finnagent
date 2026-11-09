import { callBackend } from "../../../_lib/backend";

/** As faturas e o limite do cartão. */
export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return context.params.then((params) => callBackend(`contas/${encodeURIComponent(params.id)}/faturas`));
}
