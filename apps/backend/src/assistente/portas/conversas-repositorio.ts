import type {
  AgenteIa,
  ChamadaDeFerramenta,
  ConversaResumo,
  EspecialistaIa,
  MensagemDoChat,
  MensagemDoModelo,
  ParteDaMensagem,
} from "@finnagent/contracts";

export const CONVERSAS_REPOSITORIO = Symbol("CONVERSAS_REPOSITORIO");

/**
 * Turno parado esperando a pessoa: uma pergunta com opções ou a confirmação de algo que apaga.
 * Guarda o que é preciso para retomar exatamente de onde parou.
 */
export type Pendencia = {
  usuarioId: string;
  mensagemId: string;
  agente: AgenteIa | null;
  agenteAtivo: EspecialistaIa | null;
  turno: MensagemDoModelo[];
  partes: ParteDaMensagem[];
  aguardando: { tipo: "pergunta" | "confirmacao"; chamada: ChamadaDeFerramenta };
  restantes: ChamadaDeFerramenta[];
};

export type ConversaGravada = {
  resumo: ConversaResumo;
  pendencia: Pendencia | null;
  mensagens: MensagemDoChat[];
};

/** Conversas são de cada usuário: toda leitura filtra o tenant e o usuário. */
export interface ConversasRepositorio {
  listar(tenantId: string, userId: string): Promise<ConversaResumo[]>;
  obter(tenantId: string, userId: string, id: string): Promise<ConversaGravada | null>;
  criar(tenantId: string, userId: string, id: string, title: string): Promise<ConversaResumo>;
  /** Grava ou substitui a mensagem (a do assistente cresce quando o turno retoma). */
  gravarMensagem(tenantId: string, conversationId: string, mensagem: MensagemDoChat): Promise<void>;
  definirPendencia(tenantId: string, conversationId: string, pendencia: Pendencia | null): Promise<void>;
  renomear(tenantId: string, userId: string, id: string, title: string): Promise<ConversaResumo | null>;
  remover(tenantId: string, userId: string, id: string): Promise<boolean>;
  removerTodas(tenantId: string, userId: string): Promise<number>;
  /** Apaga as conversas paradas desde antes da data, de todos os usuários do tenant. */
  limparAntigas(tenantId: string, antesDe: Date): Promise<number>;
}
