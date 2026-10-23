import { callBackend } from "../../_lib/backend";

export function GET(request: Request) {
  const year = new URL(request.url).searchParams.get("year") ?? "";
  return callBackend(`financas/geral?year=${encodeURIComponent(year)}`);
}
