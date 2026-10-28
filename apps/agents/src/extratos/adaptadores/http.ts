import type { IncomingMessage, ServerResponse } from "node:http";
import { LIMITE_ID_MODELO, idDeModelo } from "@finnagent/contracts";
import { z } from "zod";
import { erroDaUrl } from "../../assistente/dominio/url.js";
import { log } from "../../log.js";
import { OrganizarExtrato } from "../aplicacao/organizar-extrato.js";
import { ModeloIndisponivel, PedidoInvalido } from "../dominio/erros.js";

const pedido = z.object({
  tenantId: z.uuid(),
  filename: z.string().trim().min(1).max(180),
  mediaType: z.string().trim().min(1).max(80),
  content: z.string().min(1).max(8_000_000),
  apiKey: z.string().trim().min(1).max(400).optional(),
  model: z
    .string()
    .trim()
    .max(LIMITE_ID_MODELO)
    .optional()
    .refine((valor) => valor === undefined || idDeModelo(valor) === valor),
  baseUrl: z.string().trim().max(300).optional(),
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
        const campo = corpo.error.issues[0]?.path[0];
        enviar(res, 400, {
          message: campo === "model" ? "Cadastre um modelo de IA nas configurações." : "Envie uma imagem ou um PDF do extrato.",
        });
        return;
      }
      const erroDeUrl = corpo.data.baseUrl ? erroDaUrl(corpo.data.baseUrl) : null;
      if (erroDeUrl) {
        enviar(res, 400, { message: erroDeUrl });
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
      enviar(res, 500, { message: mensagemDaFalha(error) });
    }
  };
}

function enviar(res: ServerResponse, status: number, corpo: unknown) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(texto);
}

function mensagemDaFalha(error: unknown) {
  const texto = error instanceof Error ? error.message : "";
  const limpo = texto.replace(/sk-[A-Za-z0-9_-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 220);
  if (!limpo) return "Não foi possível organizar o extrato.";
  return `Não foi possível organizar o extrato. ${limpo}`;
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
