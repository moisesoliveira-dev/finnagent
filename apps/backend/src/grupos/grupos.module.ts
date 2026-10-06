import { Module } from "@nestjs/common";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { GruposService } from "./aplicacao/grupos.service.js";
import { PrismaGruposRepositorio } from "./adaptadores/prisma-grupos-repositorio.js";
import { GruposController } from "./grupos.controller.js";
import { GRUPOS_REPOSITORIO } from "./portas/grupos-repositorio.js";

@Module({
  imports: [PersistenciaModule],
  controllers: [GruposController],
  exports: [GRUPOS_REPOSITORIO],
  providers: [
    PrismaGruposRepositorio,
    { provide: GRUPOS_REPOSITORIO, useExisting: PrismaGruposRepositorio },
    GruposService,
  ],
})
export class GruposModule {}
