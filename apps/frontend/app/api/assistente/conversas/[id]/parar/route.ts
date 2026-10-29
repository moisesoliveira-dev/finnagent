import { callBackend } from "../../../../_lib/backend";

type Contexto = { params: Promise<{ id: string }> };

export function POST(_request: Request, context: Contexto) {
  return context.params.then((params) =>
    callBackend(`assistente/conversas/${encodeURIComponent(params.id)}/parar`, { method: "POST", body: "{}" }),
  );
}
