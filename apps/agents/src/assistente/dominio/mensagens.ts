import { AIMessage, HumanMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import {
  ESPECIALISTAS_IA,
  INFO_DOS_AGENTES,
  type AgenteIa,
  type ChamadaDeFerramenta,
  type MensagemDoModelo,
} from "@finnagent/contracts";

const LIMITE_DA_NOTA = 800;

function nomeDe(agente: AgenteIa | null) {
  return agente ? INFO_DOS_AGENTES[agente].nome : "Assistente";
}

function cortar(texto: string, limite: number) {
  return texto.length > limite ? `${texto.slice(0, limite)}…` : texto;
}

/**
 * O que um agente vê da conversa. Antes da última mensagem da pessoa, só texto. Depois dela, o turno atual:
 * as chamadas de ferramenta do próprio agente seguem estruturadas; o que os outros fizeram vira uma nota
 * dentro da mensagem da pessoa. Assim nenhum provedor recebe ferramenta que não conhece e a alternância
 * pessoa/assistente fica válida.
 */
export function mensagensPara(agente: AgenteIa | null, mensagens: MensagemDoModelo[]): BaseMessage[] {
  const ultima = mensagens.map((item) => item.role).lastIndexOf("user");
  const historico = ultima < 0 ? mensagens : mensagens.slice(0, ultima);
  const turno = ultima < 0 ? [] : mensagens.slice(ultima + 1);
  const saida: BaseMessage[] = [];

  for (const mensagem of historico) {
    if (mensagem.role === "tool" || !mensagem.content.trim()) continue;
    juntar(saida, mensagem.role === "user" ? "user" : "assistant", mensagem.content);
  }

  const proprias = new Set<string>();
  const notas: string[] = [];
  const estruturadas: BaseMessage[] = [];
  const chamadasAlheias = new Map<string, ChamadaDeFerramenta & { agente: AgenteIa | null }>();

  for (const mensagem of turno) {
    if (mensagem.role === "assistant") {
      const doAgente = agente !== null && mensagem.agente === agente;
      if (doAgente && mensagem.toolCalls?.length) {
        for (const chamada of mensagem.toolCalls) proprias.add(chamada.id);
        estruturadas.push(
          new AIMessage({
            content: mensagem.content,
            tool_calls: mensagem.toolCalls.map((chamada) => ({
              id: chamada.id,
              name: chamada.nome,
              args: chamada.args,
              type: "tool_call" as const,
            })),
          }),
        );
        continue;
      }
      if (mensagem.content.trim()) notas.push(`${nomeDe(mensagem.agente)}: ${cortar(mensagem.content.trim(), LIMITE_DA_NOTA)}`);
      for (const chamada of mensagem.toolCalls ?? []) chamadasAlheias.set(chamada.id, { ...chamada, agente: mensagem.agente });
      continue;
    }
    if (mensagem.role === "tool") {
      if (proprias.has(mensagem.toolCallId)) {
        estruturadas.push(new ToolMessage({ content: mensagem.content, tool_call_id: mensagem.toolCallId, name: mensagem.nome }));
        continue;
      }
      const chamada = chamadasAlheias.get(mensagem.toolCallId);
      notas.push(
        `${nomeDe(chamada?.agente ?? mensagem.agente)} usou ${mensagem.nome}: ${cortar(mensagem.content, LIMITE_DA_NOTA)}`,
      );
    }
  }

  const pedido = ultima < 0 ? "Continue." : mensagens[ultima].content;
  const comNotas = notas.length ? `${pedido}\n\n[Já feito neste pedido]\n${notas.join("\n")}` : pedido;
  juntar(saida, "user", comNotas);
  saida.push(...completarResultados(estruturadas));
  return saida;
}

/** Duas mensagens seguidas do mesmo lado viram uma só: alguns provedores recusam a repetição. */
function juntar(saida: BaseMessage[], lado: "user" | "assistant", texto: string) {
  const anterior = saida[saida.length - 1];
  const mesmoLado =
    anterior && ((lado === "user" && anterior instanceof HumanMessage) || (lado === "assistant" && anterior instanceof AIMessage));
  if (mesmoLado) {
    const junto = `${String(anterior.content)}\n\n${texto}`;
    saida[saida.length - 1] = lado === "user" ? new HumanMessage(junto) : new AIMessage(junto);
    return;
  }
  saida.push(lado === "user" ? new HumanMessage(texto) : new AIMessage(texto));
}

/** Toda chamada precisa de um resultado logo depois; se faltar, o provedor recusa a conversa. */
function completarResultados(mensagens: BaseMessage[]) {
  const saida: BaseMessage[] = [];
  let indice = 0;
  while (indice < mensagens.length) {
    const mensagem = mensagens[indice];
    saida.push(mensagem);
    indice += 1;
    if (!(mensagem instanceof AIMessage) || !mensagem.tool_calls?.length) continue;
    const respondidas = new Set<string>();
    while (indice < mensagens.length && mensagens[indice] instanceof ToolMessage) {
      const resultado = mensagens[indice] as ToolMessage;
      respondidas.add(resultado.tool_call_id);
      saida.push(resultado);
      indice += 1;
    }
    for (const chamada of mensagem.tool_calls) {
      if (chamada.id && !respondidas.has(chamada.id)) {
        saida.push(new ToolMessage({ content: "Sem resultado.", tool_call_id: chamada.id, name: chamada.name }));
      }
    }
  }
  return saida;
}

/** A triagem lê a conversa como texto, sem ferramentas: funciona em qualquer provedor. */
export function conversaParaTriagem(mensagens: MensagemDoModelo[]) {
  const linhas = mensagens
    .filter((item) => item.role !== "tool" && item.content.trim())
    .slice(-8)
    .map((item) => `${item.role === "user" ? "Pessoa" : nomeDe(item.agente)}: ${cortar(item.content.trim(), 600)}`);
  return linhas.join("\n");
}

const SEM_ACENTO = /[̀-ͯ]/g;

/** Lê a palavra escolhida pela triagem. Na dúvida, ninguém age: a conversa segue sem ferramentas. */
export function escolhaDaTriagem(texto: string) {
  const limpo = texto.normalize("NFD").replace(SEM_ACENTO, "").toLowerCase();
  const palavras = limpo.match(/[a-z]+/g) ?? [];
  for (const palavra of palavras) {
    const achado = ESPECIALISTAS_IA.find((item) => item === palavra);
    if (achado) return achado;
    if (palavra === "nenhum") return null;
  }
  return null;
}

export function textoDe(conteudo: unknown): string {
  if (typeof conteudo === "string") return conteudo;
  if (!Array.isArray(conteudo)) return "";
  return conteudo
    .map((parte) => {
      if (typeof parte === "string") return parte;
      if (parte && typeof parte === "object" && "type" in parte && parte.type === "text" && "text" in parte) {
        return String(parte.text);
      }
      return "";
    })
    .join("");
}
