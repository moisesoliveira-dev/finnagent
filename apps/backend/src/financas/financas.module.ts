import { Module } from "@nestjs/common";
import { GruposModule } from "../grupos/grupos.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaFinancasRepositorio } from "./adaptadores/prisma-financas-repositorio.js";
import { FinancasService } from "./aplicacao/financas.service.js";
import { FinancasController } from "./financas.controller.js";
import { FINANCAS_REPOSITORIO } from "./portas/financas-repositorio.js";

@Module({
  imports: [PersistenciaModule, GruposModule],
  controllers: [FinancasController],
  providers: [
    PrismaFinancasRepositorio,
    { provide: FINANCAS_REPOSITORIO, useExisting: PrismaFinancasRepositorio },
    FinancasService,
  ],
})
export class FinancasModule {}
