import { Module } from "@nestjs/common";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaContasRepositorio } from "./adaptadores/prisma-contas-repositorio.js";
import { ContasService } from "./aplicacao/contas.service.js";
import { ContasController } from "./contas.controller.js";
import { CONTAS_REPOSITORIO } from "./portas/contas-repositorio.js";

@Module({
  imports: [PersistenciaModule],
  controllers: [ContasController],
  exports: [ContasService],
  providers: [PrismaContasRepositorio, { provide: CONTAS_REPOSITORIO, useExisting: PrismaContasRepositorio }, ContasService],
})
export class ContasModule {}
