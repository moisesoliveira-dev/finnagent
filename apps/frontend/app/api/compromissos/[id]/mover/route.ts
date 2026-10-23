import { callBackend } from "../../../_lib/backend";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return request.text().then((body) =>
    context.params.then((params) =>
      callBackend(`compromissos/${params.id}/mover`, { method: "POST", body }),
    ),
  );
}
