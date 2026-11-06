import { Module } from "@nestjs/common";
import { AgendaModule } from "../agenda/agenda.module.js";
import { ExtratosModule } from "../extratos/extratos.module.js";
import { FinancasModule } from "../financas/financas.module.js";
import { MetasModule } from "../metas/metas.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaTarefasRepositorio } from "./adaptadores/prisma-tarefas-repositorio.js";
import { HojeService } from "./aplicacao/hoje.service.js";
import { HojeController } from "./hoje.controller.js";
import { TAREFAS_REPOSITORIO } from "./portas/tarefas-repositorio.js";

@Module({
  imports: [PersistenciaModule, AgendaModule, FinancasModule, ExtratosModule, MetasModule],
  controllers: [HojeController],
  exports: [HojeService],
  providers: [PrismaTarefasRepositorio, { provide: TAREFAS_REPOSITORIO, useExisting: PrismaTarefasRepositorio }, HojeService],
})
export class HojeModule {}
