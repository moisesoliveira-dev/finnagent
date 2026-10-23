import type {
  Calendario,
  CategoriaCompromisso,
  Compromisso,
  FusoAgenda,
  NomeAgenda,
  StatusCompromisso,
} from "@finnagent/contracts";
import type { EventoGoogle } from "../dominio/sincronizar.js";

export const AGENDA_REPOSITORIO = Symbol("AGENDA_REPOSITORIO");

export type NovoCompromisso = {
  id: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  status: StatusCompromisso;
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
  startAt: Date;
  endAt: Date;
  time: string | null;
  calendar: NomeAgenda;
  timezone: FusoAgenda;
  category: CategoriaCompromisso;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
  entryId: string | null;
};

export type FalhaDeCompromisso = "identificador" | "lancamento-ausente" | "ausente";

export interface AgendaRepositorio {
  listarCalendarios(tenantId: string): Promise<Calendario[]>;
  listarQueAlcancam(tenantId: string, year: number, month: number): Promise<Compromisso[]>;
  obter(tenantId: string, id: string): Promise<Compromisso | null>;
  criar(tenantId: string, pedido: NovoCompromisso): Promise<Compromisso | FalhaDeCompromisso>;
  atualizar(tenantId: string, pedido: NovoCompromisso): Promise<Compromisso | FalhaDeCompromisso>;
  excluir(tenantId: string, id: string): Promise<void | "ausente">;
  atualizarFuso(
    tenantId: string,
    name: NomeAgenda,
    timezone: FusoAgenda,
  ): Promise<Calendario>;
  atualizarStatus(
    tenantId: string,
    id: string,
    status: StatusCompromisso,
  ): Promise<Compromisso | "ausente">;
  aplicarGoogle(tenantId: string, eventos: EventoGoogle[]): Promise<{ atualizados: number }>;
}
