import { callBackend } from "../../../../_lib/backend";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.text();
  return callBackend(`extratos/series/${encodeURIComponent(id)}/linhas`, { method: "POST", body });
}
