import { Module } from "@nestjs/common";
import { FinancasModule } from "../financas/financas.module.js";
import { RelatoriosService } from "./aplicacao/relatorios.service.js";
import { RelatoriosController } from "./relatorios.controller.js";

@Module({
  imports: [FinancasModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService],
})
export class RelatoriosModule {}
