import { callBackend } from "../../_lib/backend";

export function GET() {
  return callBackend("auth/eu");
}
