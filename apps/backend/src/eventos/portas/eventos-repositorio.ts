import type { FiltroDeEventos, LinhaOutbox } from "@finnagent/contracts";
import type { Contagem, ContagemNoDia } from "../dominio/pagina.js";

export const EVENTOS_REPOSITORIO = Symbol("EVENTOS_REPOSITORIO");

/** O que os filtros encontram. Cada contagem ignora o próprio filtro; o volume ignora o dia e começa em `desde`. */
export type ResumoDeEventos = {
  total: number;
  porCategoria: Contagem[];
  porStatus: Contagem[];
  porDia: ContagemNoDia[];
};

export interface EventosRepositorio {
  resumir(tenantId: string, filtro: FiltroDeEventos, fuso: string, desde: string): Promise<ResumoDeEventos>;
  /** Do mais recente ao mais antigo. */
  listar(tenantId: string, filtro: FiltroDeEventos, fuso: string, deslocamento: number, tamanho: number): Promise<LinhaOutbox[]>;
  /** `busca` vazia não filtra; `desde` null não corta pela retenção. */
  contarConsumidos(tenantId: string, busca: string, desde: Date | null): Promise<number>;
  listarConsumidos(
    tenantId: string,
    busca: string,
    desde: Date | null,
    deslocamento: number,
    tamanho: number,
  ): Promise<LinhaOutbox[]>;
  buscar(tenantId: string, id: string): Promise<LinhaOutbox | null>;
}
