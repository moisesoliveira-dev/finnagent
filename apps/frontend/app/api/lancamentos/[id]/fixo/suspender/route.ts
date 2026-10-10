import { callBackend } from "../../../../_lib/backend";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return request.text().then((body) =>
    context.params.then((params) =>
      callBackend(`lancamentos/${params.id}/fixo/suspender`, { method: "POST", body }),
    ),
  );
}
