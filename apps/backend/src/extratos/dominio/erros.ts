export class PedidoInvalido extends Error {}

export class AgenteIndisponivel extends Error {
  constructor() {
    super("A leitura do extrato não está disponível.");
  }
}
