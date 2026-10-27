export class CredenciaisInvalidas extends Error {
  constructor() {
    super("E-mail ou senha incorretos.");
  }
}

export class EmailEmUso extends Error {
  constructor() {
    super("Já existe uma conta com este e-mail.");
  }
}

export class NaoAutenticado extends Error {
  constructor() {
    super("Sessão inválida ou expirada.");
  }
}

/** Conta ou origem travada por excesso de tentativas. `segundos` vira o Retry-After. */
export class TentativasEsgotadas extends Error {
  constructor(readonly segundos: number) {
    super(`Muitas tentativas. Tente de novo em ${Math.max(1, Math.ceil(segundos / 60))} min.`);
  }
}
