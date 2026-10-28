import { callBackend } from "../_lib/backend";

export function GET(request: Request) {
  const year = new URL(request.url).searchParams.get("year") ?? "";
  return callBackend(year ? `feriados?year=${encodeURIComponent(year)}` : "feriados");
}

export function POST(request: Request) {
  return request.text().then((body) => callBackend("feriados", { method: "POST", body }));
}
