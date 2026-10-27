import { Module } from "@nestjs/common";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaDadosRepositorio } from "./adaptadores/prisma-dados-repositorio.js";
import { DadosService } from "./aplicacao/dados.service.js";
import { DadosController } from "./dados.controller.js";
import { DADOS_REPOSITORIO } from "./portas/dados-repositorio.js";

@Module({
  imports: [PersistenciaModule],
  controllers: [DadosController],
  providers: [
    PrismaDadosRepositorio,
    { provide: DADOS_REPOSITORIO, useExisting: PrismaDadosRepositorio },
    DadosService,
  ],
})
export class DadosModule {}
