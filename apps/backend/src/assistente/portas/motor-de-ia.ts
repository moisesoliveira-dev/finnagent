import type { EventoDoPasso, PedidoDePasso, PedidoDeTesteDoProvedor, ResultadoDoTeste } from "@finnagent/contracts";

export const MOTOR_DE_IA = Symbol("MOTOR_DE_IA");

/** O agents, que raciocina. Ele nunca toca nos dados: devolve as chamadas para o backend executar. */
export interface MotorDeIa {
  /** Repassa texto e troca de agente em `aoEvento`; devolve o evento final do passo. */
  passo(pedido: PedidoDePasso, aoEvento: (evento: EventoDoPasso) => void, sinal: AbortSignal): Promise<EventoDoPasso>;
  testar(pedido: PedidoDeTesteDoProvedor): Promise<ResultadoDoTeste>;
}
