import { Module } from "@nestjs/common";
import { ConfiguracoesModule } from "../configuracoes/configuracoes.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaFinancasRepositorio } from "./adaptadores/prisma-financas-repositorio.js";
import { FinancasService } from "./aplicacao/financas.service.js";
import { FinancasController } from "./financas.controller.js";
import { FINANCAS_REPOSITORIO } from "./portas/financas-repositorio.js";

@Module({
  imports: [PersistenciaModule, ConfiguracoesModule],
  exports: [FinancasService],
  controllers: [FinancasController],
  providers: [
    PrismaFinancasRepositorio,
    { provide: FINANCAS_REPOSITORIO, useExisting: PrismaFinancasRepositorio },
    FinancasService,
  ],
})
export class FinancasModule {}
