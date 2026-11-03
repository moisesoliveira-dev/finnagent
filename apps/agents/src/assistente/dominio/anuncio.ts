import { RECUSA_DE_ESCRITA_FORA_DO_PLANO, type MensagemDoModelo } from "@finnagent/contracts";

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const ACOES =
  "criar|propor|organizar|lancar|registrar|cadastrar|adicionar|separar|mover|apagar|excluir|remover|editar|atualizar|alterar|cancelar|pagar|montar|fazer|ajustar";

// "Vou criar o grupo...", "preciso propor o plano antes de mudar", "proponho o seguinte plano".
const ANUNCIOS = [
  new RegExp(`\\b(vou|vamos|irei|posso)\\s+(agora\\s+)?(${ACOES})\\b`),
  /\b(preciso|devo|tenho que)\s+propor\b/,
  /\bpropor\s+(o|um)\s+plano\b/,
  /\bproponho\b/,
];

/**
 * O consultor disse que vai mudar algo, ou que precisa propor o plano, mas não chamou propor_plano. Texto que
 * termina em pergunta é conversa (ele está pedindo uma escolha), não promessa.
 */
export function anunciaMudanca(texto: string) {
  const limpo = semAcento(texto).trim();
  if (!limpo || limpo.endsWith("?")) return false;
  return ANUNCIOS.some((regra) => regra.test(limpo));
}

/** O backend acabou de recusar uma escrita fora do plano: a próxima volta tem de ser o plano. */
export function recusouEscrita(mensagens: MensagemDoModelo[]) {
  const ultima = mensagens.at(-1);
  return ultima?.role === "tool" && ultima.content.startsWith(RECUSA_DE_ESCRITA_FORA_DO_PLANO);
}

/** O aviso da segunda chance. Vai só para o modelo nessa volta e não entra no histórico da conversa. */
export const AVISO_DA_SEGUNDA_CHANCE =
  "[Sistema] Nada foi proposto ainda: só o plano, pela ferramenta propor_plano, muda o sistema. Chame propor_plano agora com o objetivo, o entendimento, as suposições e todos os passos do pedido da pessoa. Se faltar uma escolha, assuma o mais provável e escreva como suposição.";
