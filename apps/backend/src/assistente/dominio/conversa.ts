import type {
  MensagemDoChat,
  MensagemDoModelo,
  ParteDaMensagem,
  RetencaoDoChat,
} from "@finnagent/contracts";
import { anexosDasPartes, linhaDoAnexo } from "./anexos.js";
import { limpar, textoDoResultado } from "./resultados.js";

/** Mensagens anteriores que o modelo recebe. Mais que isso pesa no custo e pouco ajuda. */
export const LIMITE_DO_HISTORICO = 20;

/** Quanto do resultado de uma ferramenta o modelo lê. O resto é cortado, com aviso. */
export const LIMITE_DO_RESULTADO = 12_000;

/** A conferência do mês inteiro (até 200 linhas) precisa caber: o modelo propõe o plano a partir dela. */
export const LIMITE_DO_RESULTADO_DA_CONFERENCIA = 60_000;

const LIMITE_POR_FERRAMENTA: Record<string, number> = { consultar_conferencia: LIMITE_DO_RESULTADO_DA_CONFERENCIA };

export function tituloDe(texto: string) {
  const linha = texto.split("\n").find((item) => item.trim())?.replace(/\s+/g, " ").trim() ?? "Nova conversa";
  return linha.length > 60 ? `${linha.slice(0, 57).trimEnd()}…` : linha;
}

export function textoDas(partes: ParteDaMensagem[]) {
  return partes
    .filter((parte): parte is Extract<ParteDaMensagem, { tipo: "texto" }> => parte.tipo === "texto")
    .map((parte) => parte.texto)
    .join("")
    .trim();
}

/**
 * Turnos anteriores viram só texto: o pedido da pessoa e a resposta, com as ações e perguntas
 * resumidas. Os detalhes das ferramentas ficam só no turno atual.
 */
export function historicoParaOModelo(mensagens: MensagemDoChat[]): MensagemDoModelo[] {
  const recentes = mensagens.slice(-LIMITE_DO_HISTORICO);
  const inicio = recentes.findIndex((item) => item.role === "user");
  if (inicio < 0) return [];
  return recentes.slice(inicio).flatMap((mensagem): MensagemDoModelo[] => {
    const texto = textoDas(mensagem.partes);
    if (mensagem.role === "user") {
      const conteudo = [texto, ...anexosDasPartes(mensagem.partes).map(linhaDoAnexo)].filter(Boolean).join("\n");
      return conteudo ? [{ role: "user", content: conteudo }] : [];
    }
    const extras: string[] = [];
    const acoes = mensagem.partes.flatMap((parte) => (parte.tipo === "acao" && parte.acao.estado === "feita" ? [parte.acao.rotulo] : []));
    if (acoes.length) extras.push(`(Ações feitas: ${acoes.join("; ")}.)`);
    for (const parte of mensagem.partes) {
      if (parte.tipo === "pergunta") {
        extras.push(`(Perguntou: ${parte.pergunta.texto} Resposta: ${parte.pergunta.resposta ?? "sem resposta"}.)`);
      }
    }
    const conteudo = [texto, ...extras].filter(Boolean).join("\n");
    return conteudo ? [{ role: "assistant", content: conteudo, agente: mensagem.agente }] : [];
  });
}

/** O resultado da API, em texto: compacto quando a ferramenta tem formato, JSON limpo quando não; cortado se for grande. */
export function resultadoParaOModelo(corpo: unknown, ferramenta?: string) {
  if (corpo === null || corpo === undefined) return "Feito.";
  const texto =
    typeof corpo === "string"
      ? corpo
      : (ferramenta ? textoDoResultado(ferramenta, corpo) : null) ?? JSON.stringify(limpar(corpo));
  const limite = (ferramenta && LIMITE_POR_FERRAMENTA[ferramenta]) || LIMITE_DO_RESULTADO;
  if (texto.length <= limite) return texto;
  return `${texto.slice(0, limite)}\n(resultado cortado: peça um filtro mais estreito se precisar do resto)`;
}

const DIAS: Record<RetencaoDoChat, number | null> = { "30d": 30, "90d": 90, "1a": 365, sempre: null };

/** Até quando as conversas ficam guardadas. `null` guarda sem limite. */
export function limiteDaRetencao(retencao: RetencaoDoChat, agora = new Date()) {
  const dias = DIAS[retencao];
  return dias === null ? null : new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
}
