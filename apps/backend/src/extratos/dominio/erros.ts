export class PedidoInvalido extends Error {}

export class AgenteIndisponivel extends Error {
  constructor(message = "A leitura do extrato não está disponível.") {
    super(message);
  }
}
