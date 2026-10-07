import { Module } from "@nestjs/common";
import { FinancasModule } from "../financas/financas.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaAgendaRepositorio } from "./adaptadores/prisma-agenda-repositorio.js";
import { AgendaService } from "./aplicacao/agenda.service.js";
import { AgendaController } from "./agenda.controller.js";
import { AGENDA_REPOSITORIO } from "./portas/agenda-repositorio.js";

@Module({
  imports: [PersistenciaModule, FinancasModule],
  controllers: [AgendaController],
  providers: [
    PrismaAgendaRepositorio,
    { provide: AGENDA_REPOSITORIO, useExisting: PrismaAgendaRepositorio },
    AgendaService,
  ],
})
export class AgendaModule {}
