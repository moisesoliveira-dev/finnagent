import {
  CRIATIVIDADES,
  FUNCOES_DE_MODELO,
  INFO_DOS_PROVEDORES,
  LIMITE_INSTRUCOES_IA,
  LIMITE_MENSAGEM_DO_CHAT,
  LIMITE_MODELOS_POR_PROVEDOR,
  PROVEDORES_IA,
  RETENCOES_DO_CHAT,
  idDeModelo,
  type ConfiguracaoDoAssistente,
  type PedidoDeMensagem,
  type PedidoDeProvedor,
} from "@finnagent/contracts";
import { z } from "zod";

const modelo = z
  .string()
  .transform((valor) => idDeModelo(valor))
  .refine(Boolean, "Nome de modelo inválido.");

const provedor = z.object({
  kind: z.enum(PROVEDORES_IA),
  label: z.string().trim().min(1).max(60),
  apiKey: z.string().trim().max(400).default(""),
  limparChave: z.boolean().default(false),
  baseUrl: z.string().trim().max(300).default(""),
  models: z.array(modelo).max(LIMITE_MODELOS_POR_PROVEDOR).default([]),
});

export function interpretarProvedor(corpo: unknown): PedidoDeProvedor | string {
  const lido = provedor.safeParse(corpo);
  if (!lido.success) {
    const campo = String(lido.error.issues[0]?.path[0] ?? "");
    if (campo === "label") return "Dê um nome ao provedor.";
    if (campo === "models") return `Use até ${LIMITE_MODELOS_POR_PROVEDOR} modelos, com nomes sem espaço.`;
    return "Confira os dados do provedor.";
  }
  const pedido = { ...lido.data, models: [...new Set(lido.data.models)] };
  const info = INFO_DOS_PROVEDORES[pedido.kind];
  if (!info.precisaUrl) return { ...pedido, baseUrl: "" };
  if (!pedido.baseUrl) return "Informe a URL do provedor.";
  try {
    const url = new URL(pedido.baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "A URL precisa começar com http ou https.";
  } catch {
    return "A URL do provedor é inválida.";
  }
  return { ...pedido, baseUrl: pedido.baseUrl.replace(/\/+$/, "") };
}

/** Teste de um provedor ainda não salvo, ou de um salvo com outra chave ou URL. */
const teste = z.object({
  kind: z.enum(PROVEDORES_IA),
  apiKey: z.string().trim().max(400).default(""),
  baseUrl: z.string().trim().max(300).default(""),
  providerId: z.uuid().nullable().default(null),
});

export function interpretarTeste(corpo: unknown) {
  const lido = teste.safeParse(corpo);
  return lido.success ? lido.data : "Confira os dados do provedor.";
}

const escolha = z.object({ providerId: z.uuid(), model: modelo }).nullable();

const assistente = z.object({
  padrao: escolha,
  funcoes: z.partialRecord(z.enum(FUNCOES_DE_MODELO), escolha).default({}),
  comportamento: z.object({
    confirmarExclusao: z.boolean(),
    maxPassos: z.union([z.literal(4), z.literal(8), z.literal(12)]),
    criatividade: z.enum(CRIATIVIDADES),
    instrucoes: z.string().trim().max(LIMITE_INSTRUCOES_IA),
    retencao: z.enum(RETENCOES_DO_CHAT),
  }),
});

export function interpretarAssistente(corpo: unknown): ConfiguracaoDoAssistente | string {
  const lido = assistente.safeParse(corpo);
  if (!lido.success) {
    const caminho = lido.error.issues[0]?.path.join(".") ?? "";
    if (caminho.includes("instrucoes")) return `As instruções passam de ${LIMITE_INSTRUCOES_IA} caracteres.`;
    return "Confira as escolhas do assistente.";
  }
  return lido.data;
}

const mensagem = z
  .object({
    conversationId: z.uuid().nullable().default(null),
    texto: z.string().trim().min(1).max(LIMITE_MENSAGEM_DO_CHAT).optional(),
    resposta: z
      .object({ perguntaId: z.string().min(1).max(200), escolha: z.string().trim().min(1).max(300) })
      .optional(),
  })
  .refine((pedido) => Boolean(pedido.texto) !== Boolean(pedido.resposta));

export function interpretarMensagem(corpo: unknown): PedidoDeMensagem | string {
  const lido = mensagem.safeParse(corpo);
  if (lido.success) return lido.data;
  const caminho = lido.error.issues[0]?.path.join(".") ?? "";
  if (caminho === "texto") return `Escreva uma mensagem de até ${LIMITE_MENSAGEM_DO_CHAT} caracteres.`;
  return "Escreva uma mensagem ou escolha uma opção.";
}

export function interpretarTitulo(corpo: unknown) {
  const lido = z.object({ title: z.string().trim().min(1).max(80) }).safeParse(corpo);
  return lido.success ? lido.data.title : "Dê um título de até 80 caracteres.";
}
