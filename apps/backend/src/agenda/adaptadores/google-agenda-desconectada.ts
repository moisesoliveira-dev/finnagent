import { Injectable } from "@nestjs/common";
import type { GoogleAgenda } from "../portas/google-agenda.js";

@Injectable()
export class GoogleAgendaDesconectada implements GoogleAgenda {
  listar(): Promise<"desconectado"> {
    return Promise.resolve("desconectado");
  }
}
