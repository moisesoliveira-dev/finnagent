import { callBackend } from "../_lib/backend";

export function GET(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  params.set("scope", url.searchParams.get("scope") ?? "");
  params.set("year", url.searchParams.get("year") ?? "");
  const month = url.searchParams.get("month");
  const day = url.searchParams.get("day");
  if (month) params.set("month", month);
  if (day) params.set("day", day);
  return callBackend(`painel?${params.toString()}`);
}
