import { Module } from "@nestjs/common";
import { ConfiguracoesModule } from "../configuracoes/configuracoes.module.js";
import { FinancasModule } from "../financas/financas.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { GoogleAgendaHttp } from "./adaptadores/google-agenda-http.js";
import { PrismaAgendaRepositorio } from "./adaptadores/prisma-agenda-repositorio.js";
import { AgendaService } from "./aplicacao/agenda.service.js";
import { AgendaController } from "./agenda.controller.js";
import { AGENDA_REPOSITORIO } from "./portas/agenda-repositorio.js";
import { GOOGLE_AGENDA } from "./portas/google-agenda.js";

@Module({
  imports: [PersistenciaModule, FinancasModule, ConfiguracoesModule],
  exports: [AgendaService],
  controllers: [AgendaController],
  providers: [
    PrismaAgendaRepositorio,
    GoogleAgendaHttp,
    { provide: AGENDA_REPOSITORIO, useExisting: PrismaAgendaRepositorio },
    { provide: GOOGLE_AGENDA, useExisting: GoogleAgendaHttp },
    AgendaService,
  ],
})
export class AgendaModule {}
