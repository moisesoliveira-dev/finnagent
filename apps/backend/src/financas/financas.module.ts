import { Module } from "@nestjs/common";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaFinancasRepositorio } from "./adaptadores/prisma-financas-repositorio.js";
import { FinancasService } from "./aplicacao/financas.service.js";
import { FinancasController } from "./financas.controller.js";
import { FINANCAS_REPOSITORIO } from "./portas/financas-repositorio.js";

@Module({
  imports: [PersistenciaModule],
  exports: [FinancasService],
  controllers: [FinancasController],
  providers: [
    PrismaFinancasRepositorio,
    { provide: FINANCAS_REPOSITORIO, useExisting: PrismaFinancasRepositorio },
    FinancasService,
  ],
})
export class FinancasModule {}
