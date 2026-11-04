export type ArquivoDeExtrato = {
  filename: string;
  mediaType: string;
  conteudo: string;
};

export type LeitorDeExtrato = {
  ler(arquivo: ArquivoDeExtrato): Promise<string>;
};

export type ModeloDeExtrato = {
  /** As linhas em JSON, e se a resposta do modelo veio cortada no meio. */
  organizarTexto(texto: string): Promise<{ linhas: unknown[]; cortada: boolean }>;
};
