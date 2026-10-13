import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { log } from "../../log.js";
import { OrganizarExtrato } from "../aplicacao/organizar-extrato.js";
import { ModeloIndisponivel, PedidoInvalido } from "../dominio/erros.js";

const pedido = z.object({
  tenantId: z.uuid(),
  filename: z.string().trim().min(1).max(180),
  mediaType: z.string().trim().min(1).max(80),
  content: z.string().min(1).max(8_000_000),
});

const LIMITE = 8_000_000;

export function tratarExtrato(servico: OrganizarExtrato) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "GET" && req.url === "/health") {
      enviar(res, 200, { ok: true });
      return;
    }
    if (req.method !== "POST" || req.url !== "/extratos/organizar") {
      enviar(res, 404, { message: "Não encontrado." });
      return;
    }
    try {
      const corpo = pedido.safeParse(JSON.parse(await lerCorpo(req)));
      if (!corpo.success) {
        enviar(res, 400, { message: "Envie uma imagem ou um PDF do extrato." });
        return;
      }
      const lines = await servico.organizar(corpo.data);
      log.info({ tenantId: corpo.data.tenantId, linhas: lines.length }, "extrato organizado");
      enviar(res, 200, { lines });
    } catch (error) {
      if (error instanceof PedidoInvalido) {
        enviar(res, 400, { message: error.message });
        return;
      }
      if (error instanceof ModeloIndisponivel) {
        enviar(res, 503, { message: error.message });
        return;
      }
      if (error instanceof Error && error.message === "grande") {
        enviar(res, 400, { message: "O arquivo passa de 5 MB." });
        return;
      }
      log.error({ err: error instanceof Error ? error.message : "falha" }, "falha ao organizar o extrato");
      enviar(res, 500, { message: "Não foi possível organizar o extrato." });
    }
  };
}

function enviar(res: ServerResponse, status: number, corpo: unknown) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(texto);
}

async function lerCorpo(req: IncomingMessage) {
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    const bloco = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
    total += bloco.length;
    if (total > LIMITE) throw new Error("grande");
    partes.push(bloco);
  }
  return Buffer.concat(partes).toString("utf8");
}
