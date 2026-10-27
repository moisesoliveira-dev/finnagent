/** Janela deslizante em memória. Há uma réplica por serviço, então um mapa basta. */
export class Limitador {
  private readonly registros = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
    private readonly agora: () => number = Date.now,
    private readonly capacidade = 10_000,
  ) {}

  /** Conta uma tentativa. Devolve 0 se passou, ou os segundos até liberar. */
  registrar(chave: string) {
    const agora = this.agora();
    const recentes = (this.registros.get(chave) ?? []).filter((marca) => agora - marca < this.janelaMs);
    if (recentes.length >= this.maximo) {
      this.registros.set(chave, recentes);
      return Math.ceil((recentes[0] + this.janelaMs - agora) / 1000);
    }
    recentes.push(agora);
    this.registros.delete(chave);
    this.registros.set(chave, recentes);
    if (this.registros.size > this.capacidade) {
      const maisAntiga = this.registros.keys().next().value;
      if (maisAntiga !== undefined) this.registros.delete(maisAntiga);
    }
    return 0;
  }
}
