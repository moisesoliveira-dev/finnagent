export class PedidoInvalido extends Error {}

export class ModeloIndisponivel extends Error {
  constructor() {
    super("A leitura do extrato precisa da chave do modelo.");
  }
}
