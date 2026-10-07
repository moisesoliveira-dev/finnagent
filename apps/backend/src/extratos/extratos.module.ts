import { Module } from "@nestjs/common";
import { FinancasModule } from "../financas/financas.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaExtratosRepositorio } from "./adaptadores/prisma-extratos-repositorio.js";
import { ExtratosService } from "./aplicacao/extratos.service.js";
import { ExtratosController } from "./extratos.controller.js";
import { EXTRATOS_REPOSITORIO } from "./portas/extratos-repositorio.js";

@Module({
  imports: [PersistenciaModule, FinancasModule],
  controllers: [ExtratosController],
  providers: [
    PrismaExtratosRepositorio,
    { provide: EXTRATOS_REPOSITORIO, useExisting: PrismaExtratosRepositorio },
    ExtratosService,
  ],
})
export class ExtratosModule {}
