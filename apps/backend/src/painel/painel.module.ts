import { Module } from "@nestjs/common";
import { AgendaModule } from "../agenda/agenda.module.js";
import { FinancasModule } from "../financas/financas.module.js";
import { PainelService } from "./aplicacao/painel.service.js";
import { PainelController } from "./painel.controller.js";

@Module({
  imports: [FinancasModule, AgendaModule],
  controllers: [PainelController],
  providers: [PainelService],
})
export class PainelModule {}
