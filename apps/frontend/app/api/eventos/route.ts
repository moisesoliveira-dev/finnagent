import { callBackend } from "../_lib/backend";

export function GET() {
  return callBackend("eventos");
}
