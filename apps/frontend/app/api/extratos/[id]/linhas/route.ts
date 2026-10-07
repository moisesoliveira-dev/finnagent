import { callBackend } from "../../../_lib/backend";

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const erros = new URL(request.url).searchParams.get("erros") === "1" ? "?erros=1" : "";
  return context.params.then((params) => callBackend(`extratos/${params.id}/linhas${erros}`));
}
