export type ArquivoDeExtrato = {
  filename: string;
  mediaType: string;
  conteudo: string;
};

export type LeitorDeExtrato = {
  ler(arquivo: ArquivoDeExtrato): Promise<string>;
};

export type ModeloDeExtrato = {
  organizarTexto(texto: string): Promise<unknown>;
};
