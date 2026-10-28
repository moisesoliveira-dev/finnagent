import { Module } from "@nestjs/common";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaFeriadosRepositorio } from "./adaptadores/prisma-feriados-repositorio.js";
import { FeriadosService } from "./aplicacao/feriados.service.js";
import { FERIADOS_REPOSITORIO } from "./portas/feriados-repositorio.js";

/**
 * O núcleo: guarda os feriados locais e monta o calendário de dias úteis. Finanças e agenda usam este.
 * As rotas, que também redatam os vencimentos, ficam em FeriadosHttpModule, para finanças não depender delas.
 */
@Module({
  imports: [PersistenciaModule],
  exports: [FeriadosService],
  providers: [
    PrismaFeriadosRepositorio,
    { provide: FERIADOS_REPOSITORIO, useExisting: PrismaFeriadosRepositorio },
    FeriadosService,
  ],
})
export class FeriadosModule {}
