import type { ConfiguracaoDoAssistente, PedidoDeProvedor, ProvedorConfigurado } from "@finnagent/contracts";

export const IA_REPOSITORIO = Symbol("IA_REPOSITORIO");

/** O provedor como está no banco, com a chave. Só o backend e o agents a veem. */
export type ProvedorGravado = ProvedorConfigurado & { apiKey: string };

/** Cada método que muda estado grava o evento no outbox, na mesma transação, sem a chave no payload. */
export interface IaRepositorio {
  listarProvedores(tenantId: string): Promise<ProvedorGravado[]>;
  criarProvedor(tenantId: string, id: string, pedido: PedidoDeProvedor): Promise<ProvedorGravado>;
  atualizarProvedor(tenantId: string, id: string, pedido: PedidoDeProvedor): Promise<ProvedorGravado | null>;
  /** Também tira o provedor do padrão e das funções que o usavam. */
  removerProvedor(tenantId: string, id: string): Promise<boolean>;
  obterAssistente(tenantId: string): Promise<ConfiguracaoDoAssistente>;
  salvarAssistente(tenantId: string, configuracao: ConfiguracaoDoAssistente): Promise<ConfiguracaoDoAssistente>;
}
