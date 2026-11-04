export type ArquivoDeExtrato = {
  filename: string;
  mediaType: string;
  conteudo: string;
  /** O que a pessoa escreveu sobre o extrato. */
  observacao?: string;
};

export type LeitorDeExtrato = {
  ler(arquivo: ArquivoDeExtrato): Promise<string>;
};

export type ModeloDeExtrato = {
  /** As linhas em JSON, e se a resposta do modelo veio cortada no meio. */
  organizarTexto(texto: string, observacao?: string): Promise<{ linhas: unknown[]; cortada: boolean }>;
};
