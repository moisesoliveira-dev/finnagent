import type { EventoGoogle } from "../dominio/sincronizar.js";

export const GOOGLE_AGENDA = Symbol("GOOGLE_AGENDA");

export interface GoogleAgenda {
  listar(tenantId: string): Promise<EventoGoogle[] | "desconectado">;
}
