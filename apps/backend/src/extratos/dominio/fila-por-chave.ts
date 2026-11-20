/**
 * Uma ação por vez em cada chave; chaves diferentes andam juntas. Quem chega depois espera a anterior terminar, com
 * sucesso ou erro, e a entrada some do mapa quando a fila esvazia.
 */
export class FilaPorChave {
  private readonly filas = new Map<string, Promise<unknown>>();

  executar<T>(chave: string, acao: () => Promise<T>): Promise<T> {
    const anterior = this.filas.get(chave) ?? Promise.resolve();
    const atual = anterior.then(acao, acao);
    const marca = atual.then(
      () => undefined,
      () => undefined,
    );
    this.filas.set(chave, marca);
    void marca.then(() => {
      if (this.filas.get(chave) === marca) this.filas.delete(chave);
    });
    return atual;
  }

  get tamanho() {
    return this.filas.size;
  }
}
