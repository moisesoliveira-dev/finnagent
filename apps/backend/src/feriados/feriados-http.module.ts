import { Module } from "@nestjs/common";
import { FinancasModule } from "../financas/financas.module.js";
import { FeriadosController } from "./feriados.controller.js";
import { FeriadosModule } from "./feriados.module.js";

/** As rotas de feriados. Ficam fora do núcleo porque redatam os vencimentos, que são de finanças. */
@Module({
  imports: [FeriadosModule, FinancasModule],
  controllers: [FeriadosController],
})
export class FeriadosHttpModule {}
