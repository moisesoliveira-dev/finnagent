import { Module } from "@nestjs/common";
import { FinancasModule } from "../financas/financas.module.js";
import { GruposModule } from "../grupos/grupos.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaCaixinhasRepositorio } from "./adaptadores/prisma-caixinhas-repositorio.js";
import { PrismaContasRepositorio } from "./adaptadores/prisma-contas-repositorio.js";
import { CaixinhasService } from "./aplicacao/caixinhas.service.js";
import { ContasService } from "./aplicacao/contas.service.js";
import { CaixinhasController } from "./caixinhas.controller.js";
import { ContasController } from "./contas.controller.js";
import { CAIXINHAS_REPOSITORIO } from "./portas/caixinhas-repositorio.js";
import { CONTAS_REPOSITORIO } from "./portas/contas-repositorio.js";

@Module({
  imports: [PersistenciaModule, FinancasModule, GruposModule],
  controllers: [ContasController, CaixinhasController],
  exports: [ContasService, CaixinhasService],
  providers: [
    PrismaContasRepositorio,
    { provide: CONTAS_REPOSITORIO, useExisting: PrismaContasRepositorio },
    PrismaCaixinhasRepositorio,
    { provide: CAIXINHAS_REPOSITORIO, useExisting: PrismaCaixinhasRepositorio },
    ContasService,
    CaixinhasService,
  ],
})
export class ContasModule {}
