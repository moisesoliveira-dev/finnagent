export type ArquivoDeExtrato = {
  filename: string;
  mediaType: string;
  conteudo: string;
  /** O que a pessoa escreveu sobre o extrato. */
  observacao?: string;
};

export type ContextoDaLeitura = { filename?: string; hoje?: string };

export type LeitorDeExtrato = {
  ler(arquivo: ArquivoDeExtrato): Promise<string>;
};

export type ModeloDeExtrato = {
  /** As linhas em JSON, e se a resposta do modelo veio cortada no meio. */
  /** `contexto`: o nome do arquivo e o dia de hoje, para o modelo acertar o ano de datas que vêm sem ele. */
  organizarTexto(texto: string, observacao?: string, contexto?: ContextoDaLeitura): Promise<{ linhas: unknown[]; cortada: boolean }>;
};
