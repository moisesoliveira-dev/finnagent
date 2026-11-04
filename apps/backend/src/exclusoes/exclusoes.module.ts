import { Module } from "@nestjs/common";
import { ExtratosModule } from "../extratos/extratos.module.js";
import { FinancasModule } from "../financas/financas.module.js";
import { GruposModule } from "../grupos/grupos.module.js";
import { MetasModule } from "../metas/metas.module.js";
import { ExclusoesService } from "./aplicacao/exclusoes.service.js";
import { ExclusoesController } from "./exclusoes.controller.js";

@Module({
  imports: [FinancasModule, GruposModule, ExtratosModule, MetasModule],
  controllers: [ExclusoesController],
  providers: [ExclusoesService],
})
export class ExclusoesModule {}
