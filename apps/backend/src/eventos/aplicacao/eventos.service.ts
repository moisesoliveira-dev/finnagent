import { Inject, Injectable } from "@nestjs/common";
import type { EventosResposta } from "@finnagent/contracts";
import { EVENTOS_REPOSITORIO, type EventosRepositorio } from "../portas/eventos-repositorio.js";

@Injectable()
export class EventosService {
  constructor(@Inject(EVENTOS_REPOSITORIO) private readonly eventos: EventosRepositorio) {}

  listar(tenantId: string): Promise<EventosResposta> {
    return this.eventos.listar(tenantId);
  }
}
