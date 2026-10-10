import { Module } from "@nestjs/common";
import { FinancasModule } from "../financas/financas.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { GoogleAgendaDesconectada } from "./adaptadores/google-agenda-desconectada.js";
import { PrismaAgendaRepositorio } from "./adaptadores/prisma-agenda-repositorio.js";
import { AgendaService } from "./aplicacao/agenda.service.js";
import { AgendaController } from "./agenda.controller.js";
import { AGENDA_REPOSITORIO } from "./portas/agenda-repositorio.js";
import { GOOGLE_AGENDA } from "./portas/google-agenda.js";

@Module({
  imports: [PersistenciaModule, FinancasModule],
  exports: [AgendaService],
  controllers: [AgendaController],
  providers: [
    PrismaAgendaRepositorio,
    GoogleAgendaDesconectada,
    { provide: AGENDA_REPOSITORIO, useExisting: PrismaAgendaRepositorio },
    { provide: GOOGLE_AGENDA, useExisting: GoogleAgendaDesconectada },
    AgendaService,
  ],
})
export class AgendaModule {}
