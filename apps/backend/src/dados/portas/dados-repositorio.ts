import type { DadosDoPacote, ResumoDaImportacao } from "../dominio/pacote.js";

export const DADOS_REPOSITORIO = Symbol("DADOS_REPOSITORIO");

export interface DadosRepositorio {
  /** Tudo do tenant, já em formato de JSON. Segredos e vínculos com o Google ficam de fora. */
  exportar(tenantId: string): Promise<Record<keyof DadosDoPacote, unknown>>;
  /** Troca os dados do tenant pelos do pacote, em uma transação só. */
  importar(tenantId: string, dados: DadosDoPacote, resumo: ResumoDaImportacao): Promise<void>;
  /** Apaga lançamentos, agenda, extratos, metas e o histórico. A configuração fica. */
  zerar(tenantId: string): Promise<void>;
}
