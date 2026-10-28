import { callBackend } from "../../../_lib/backend";

export function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return context.params.then((params) =>
    callBackend(`metas/${encodeURIComponent(params.id)}/aprovar`, { method: "POST", body: "{}" }),
  );
}
