import type { CategoriaCompromisso, Compromisso, NomeAgenda } from "@finnagent/contracts";

export const AGENDA_REPOSITORIO = Symbol("AGENDA_REPOSITORIO");

export type NovoCompromisso = {
  id: string;
  title: string;
  year: number;
  month: number;
  day: number;
  time: string | null;
  calendar: NomeAgenda;
  category: CategoriaCompromisso;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
  entryId: string | null;
};

export type FalhaDeCompromisso = "identificador" | "lancamento-ausente";

export interface AgendaRepositorio {
  listarQueAlcancam(tenantId: string, year: number, month: number): Promise<Compromisso[]>;
  criar(
    tenantId: string,
    pedido: NovoCompromisso,
  ): Promise<Compromisso | FalhaDeCompromisso>;
}
