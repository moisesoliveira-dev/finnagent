import { callBackend } from "../../_lib/backend";

export function GET(request: Request) {
  const url = new URL(request.url);
  const year = url.searchParams.get("year") ?? "";
  const month = url.searchParams.get("month") ?? "";
  return callBackend(`extratos/conferencia?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`);
}
