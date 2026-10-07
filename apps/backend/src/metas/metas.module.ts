import { Module } from "@nestjs/common";
import { FinancasModule } from "../financas/financas.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaMetasRepositorio } from "./adaptadores/prisma-metas-repositorio.js";
import { MetasService } from "./aplicacao/metas.service.js";
import { MetasController } from "./metas.controller.js";
import { METAS_REPOSITORIO } from "./portas/metas-repositorio.js";

@Module({
  imports: [PersistenciaModule, FinancasModule],
  controllers: [MetasController],
  providers: [
    PrismaMetasRepositorio,
    { provide: METAS_REPOSITORIO, useExisting: PrismaMetasRepositorio },
    MetasService,
  ],
})
export class MetasModule {}
