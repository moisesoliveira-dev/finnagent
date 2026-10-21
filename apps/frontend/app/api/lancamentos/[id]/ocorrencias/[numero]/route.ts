import { callBackend } from "../../../../_lib/backend";

export function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; numero: string }> },
) {
  return request.text().then((body) =>
    context.params.then((params) =>
      callBackend(`lancamentos/${params.id}/ocorrencias/${params.numero}`, {
        method: "PATCH",
        body,
      }),
    ),
  );
}
