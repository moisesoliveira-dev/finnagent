import type { IncomingMessage, ServerResponse } from "node:http";
import { LIMITE_EXTRATO_BYTES, LIMITE_ID_MODELO, LIMITE_OBSERVACAO_DO_EXTRATO, idDeModelo } from "@finnagent/contracts";
import { z } from "zod";
import { erroDaUrl } from "../../assistente/dominio/url.js";
import { log } from "../../log.js";
import { OrganizarExtrato } from "../aplicacao/organizar-extrato.js";
import { ModeloIndisponivel, PedidoInvalido } from "../dominio/erros.js";

// O arquivo em base64 ocupa 4/3 do tamanho. O corpo do pedido leva ainda o nome, o modelo e a chave.
const LIMITE_DO_CONTEUDO = Math.ceil(LIMITE_EXTRATO_BYTES / 3) * 4 + 4;
const MENSAGEM_DO_TAMANHO = `O arquivo passa de ${LIMITE_EXTRATO_BYTES / (1024 * 1024)} MB.`;

const pedido = z.object({
  tenantId: z.uuid(),
  filename: z.string().trim().min(1).max(180),
  mediaType: z.string().trim().min(1).max(80),
  content: z.string().min(1).max(LIMITE_DO_CONTEUDO),
  observacao: z.string().trim().max(LIMITE_OBSERVACAO_DO_EXTRATO).optional(),
  apiKey: z.string().trim().min(1).max(400).optional(),
  model: z
    .string()
    .trim()
    .max(LIMITE_ID_MODELO)
    .optional()
    .refine((valor) => valor === undefined || idDeModelo(valor) === valor),
  baseUrl: z.string().trim().max(300).optional(),
});

const LIMITE = LIMITE_DO_CONTEUDO + 64 * 1024;

export function tratarExtrato(servico: OrganizarExtrato) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const caminho = (req.url ?? "").split("?")[0];
    if (req.method === "GET" && caminho === "/health") {
      enviar(res, 200, { ok: true });
      return;
    }
    if (req.method !== "POST" || caminho !== "/extratos/organizar") {
      enviar(res, 404, { message: "Não encontrado." });
      return;
    }
    try {
      const corpo = pedido.safeParse(JSON.parse(await lerCorpo(req)));
      if (!corpo.success) {
        const problema = corpo.error.issues[0];
        const campo = problema?.path[0];
        const message =
          campo === "model"
            ? "Cadastre um modelo de IA nas configurações."
            : campo === "content" && problema?.code === "too_big"
              ? MENSAGEM_DO_TAMANHO
              : "Envie uma imagem ou um PDF do extrato.";
        enviar(res, 400, { message });
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
        enviar(res, 400, { message: MENSAGEM_DO_TAMANHO });
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
