export class BancoIndisponivel extends Error {
  constructor() {
    super("O Postgres não está configurado. Falta DIRECT_URL no .env.");
  }
}

export class Conflito extends Error {}

export class NaoEncontrado extends Error {}
