import { streamBackend } from "../../_lib/backend";

export function POST(request: Request) {
  return streamBackend("assistente/mensagens", request);
}
