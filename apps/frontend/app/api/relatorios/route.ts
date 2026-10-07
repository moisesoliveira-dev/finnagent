import { callBackend } from "../_lib/backend";

export function GET(request: Request) {
  const year = new URL(request.url).searchParams.get("year");
  const path = year ? `relatorios?year=${encodeURIComponent(year)}` : "relatorios";
  return callBackend(path);
}
