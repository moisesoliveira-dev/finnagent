import type { ChamadaDeFerramenta } from "@finnagent/contracts";

export const EXECUTOR_DE_FERRAMENTAS = Symbol("EXECUTOR_DE_FERRAMENTAS");

/** Quem pediu. O token é o da sessão da pessoa: a ação passa pelas mesmas regras da tela. */
export type Credencial = { token: string; fuso: string };

export type ResultadoDaExecucao = {
  ok: boolean;
  /** O que o modelo lê: o resultado, ou o erro para ele corrigir. */
  conteudo: string;
  /** Uma linha para a tela, quando falha. */
  detalhe: string;
};

export interface ExecutorDeFerramentas {
  executar(chamada: ChamadaDeFerramenta, credencial: Credencial): Promise<ResultadoDaExecucao>;
}
