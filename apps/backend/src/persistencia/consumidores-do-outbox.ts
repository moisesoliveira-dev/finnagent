import { Injectable } from "@nestjs/common";

export type EventoConsumido = {
  tenantId: string;
  operacao: string;
  idempotencyKey: string;
  payload: unknown;
};

export type Consumidor = (evento: EventoConsumido) => Promise<void>;

/**
 * Quem reage a um evento do outbox. Uma slice registra o consumidor da operação que interessa a ela,
 * e o worker do BullMQ chama na hora de consumir. O consumidor é idempotente: o mesmo evento pode chegar
 * de novo depois de uma falha.
 */
@Injectable()
export class ConsumidoresDoOutbox {
  private readonly porOperacao = new Map<string, Consumidor[]>();

  registrar(operacao: string, consumidor: Consumidor) {
    const lista = this.porOperacao.get(operacao) ?? [];
    lista.push(consumidor);
    this.porOperacao.set(operacao, lista);
  }

  tem(operacao: string) {
    return (this.porOperacao.get(operacao)?.length ?? 0) > 0;
  }

  async consumir(evento: EventoConsumido) {
    for (const consumidor of this.porOperacao.get(evento.operacao) ?? []) await consumidor(evento);
  }
}
