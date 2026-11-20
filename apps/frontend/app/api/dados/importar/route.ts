import { callBackend } from "../../_lib/backend";

// O mesmo teto do backend (10 MB). O Next corta o corpo que passa disso, um pouco antes do teto exato, e o backend
// leria um JSON pela metade, com um erro técnico. A margem pega o corpo cortado, e a pessoa recebe a causa.
const LIMITE_EM_BYTES = 10 * 1024 * 1024 - 64 * 1024;

export function POST(request: Request) {
  return request.text().then((body) => {
    if (Buffer.byteLength(body) >= LIMITE_EM_BYTES) {
      return Response.json({ message: "O arquivo passa de 10 MB." }, { status: 413 });
    }
    return callBackend("dados/importar", { method: "POST", body });
  });
}
