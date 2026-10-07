import { callBackend } from "../../../_lib/backend";

export function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return context.params.then((params) =>
    callBackend(`extratos/${params.id}/reprocessar`, { method: "POST", body: "{}" }),
  );
}
