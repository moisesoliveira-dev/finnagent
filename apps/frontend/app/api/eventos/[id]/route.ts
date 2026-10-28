import { callBackend } from "../../_lib/backend";

export function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return context.params.then((params) => callBackend(`eventos/${encodeURIComponent(params.id)}`));
}
