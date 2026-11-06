import { callBackend } from "../_lib/backend";

export function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  return callBackend(date ? `hoje?date=${encodeURIComponent(date)}` : "hoje");
}
