import { Module } from "@nestjs/common";
import { AgendaModule } from "../agenda/agenda.module.js";
import { ConfiguracoesModule } from "../configuracoes/configuracoes.module.js";
import { ExtratosModule } from "../extratos/extratos.module.js";
import { FinancasModule } from "../financas/financas.module.js";
import { PainelService } from "./aplicacao/painel.service.js";
import { PainelController } from "./painel.controller.js";

@Module({
  imports: [FinancasModule, AgendaModule, ExtratosModule, ConfiguracoesModule],
  controllers: [PainelController],
  providers: [PainelService],
})
export class PainelModule {}
