import { callBackend } from "../../../../_lib/backend";

export function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return context.params.then((params) =>
    callBackend(`lancamentos/${params.id}/emprestimo/cancelar`, {
      method: "POST",
      body: "{}",
    }),
  );
}
