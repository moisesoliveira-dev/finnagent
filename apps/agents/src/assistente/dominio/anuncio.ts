import {
  FERRAMENTA_PLANO,
  RECUSA_DE_ESCRITA_FORA_DO_PLANO,
  RECUSA_DE_PLANO,
  type MensagemDoModelo,
} from "@finnagent/contracts";

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// Verbos de quem vai agir ou consultar: "vou criar", "vamos revisar", "vou te mostrar". Explicar e ajudar ficam de
// fora: "vou te explicar" costuma ser o começo de uma resposta, não uma promessa sem ação.
const ACOES =
  "criar|propor|organizar|lancar|registrar|cadastrar|adicionar|separar|mover|apagar|excluir|remover|editar|atualizar|alterar|cancelar|pagar|montar|fazer|ajustar|revisar|conferir|verificar|consultar|checar|dividir|refazer|buscar|olhar|analisar|levantar|ler|continuar|seguir|mostrar|listar|apresentar";

const ANUNCIOS = [
  new RegExp(`\\b(vou|vamos|irei)\\s+(agora\\s+)?(te\\s+)?(${ACOES})\\b`),
  /\b(preciso|devo|tenho que)\s+(propor|refazer|dividir|rever|revisar)\b/,
  /\bpropor\s+(o|um)\s+plano\b/,
  /\bproponho\b/,
  /\bte\s+(mostro|digo|aviso|passo)\b/,
  /\bem seguida\b|\bproximo passo\b/,
];

/**
 * O consultor disse que vai agir ("vou criar", "vou revisar a conferência", "te mostro o próximo passo") ou que
 * precisa propor o plano, mas não chamou ferramenta nenhuma. Texto que termina em pergunta é conversa (ele está
 * pedindo uma escolha), não promessa.
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

/** O backend recusou o plano (grande demais, argumento inválido...): a próxima volta tem de ser o plano corrigido. */
export function recusouPlano(mensagens: MensagemDoModelo[]) {
  const ultima = mensagens.at(-1);
  return ultima?.role === "tool" && ultima.nome === FERRAMENTA_PLANO && ultima.content.trimEnd().endsWith(RECUSA_DE_PLANO);
}

/**
 * Qual ferramenta a segunda volta obriga. Depois de uma recusa, ou quando o texto fala do plano, é o propor_plano.
 * Numa promessa de consultar ou revisar, qualquer ferramenta serve: o que importa é agir em vez de narrar.
 */
export function escolhaDaSegundaChance(texto: string, mensagens: MensagemDoModelo[]): typeof FERRAMENTA_PLANO | "any" {
  if (recusouEscrita(mensagens) || recusouPlano(mensagens)) return FERRAMENTA_PLANO;
  return /\bplano\b/.test(semAcento(texto)) ? FERRAMENTA_PLANO : "any";
}

/** O aviso da segunda chance quando o que falta é o plano. Vai só para o modelo nessa volta, fora do histórico. */
export const AVISO_DA_SEGUNDA_CHANCE =
  "[Sistema] Nada foi proposto ainda: só o plano, pela ferramenta propor_plano, muda o sistema. Chame propor_plano agora com o objetivo, o entendimento, as suposições e todos os passos do pedido da pessoa (no máximo 20 passos; várias linhas de extrato únicas vão num passo só, acumular_linhas). Se faltar uma escolha, assuma o mais provável e escreva como suposição.";

/** O aviso quando o consultor prometeu consultar ou revisar e não chamou ferramenta. */
export const AVISO_DA_PROMESSA =
  "[Sistema] Você disse que ia agir, mas não chamou nenhuma ferramenta, então nada aconteceu. Faça agora: consulte o que falta (várias páginas de uma vez, se for a conferência), pergunte, ou chame propor_plano. Não responda com texto prometendo.";
