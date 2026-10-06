import { callBackend } from "../../_lib/backend";

export function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return request.text().then((body) =>
    context.params.then((params) =>
      callBackend(`sessoes/${params.id}`, { method: "PATCH", body }),
    ),
  );
}

export function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return context.params.then((params) =>
    callBackend(`sessoes/${params.id}`, { method: "DELETE" }),
  );
}
