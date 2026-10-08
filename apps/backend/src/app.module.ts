import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AgendaModule } from './agenda/agenda.module.js';
import { EventosModule } from './eventos/eventos.module.js';
import { ExtratosModule } from './extratos/extratos.module.js';
import { FinancasModule } from './financas/financas.module.js';
import { GruposModule } from './grupos/grupos.module.js';
import { MetasModule } from './metas/metas.module.js';
import { PainelModule } from './painel/painel.module.js';
import { PersistenciaModule } from './persistencia/persistencia.module.js';
import { RelatoriosModule } from './relatorios/relatorios.module.js';

@Module({
  imports: [
    PersistenciaModule,
    GruposModule,
    FinancasModule,
    AgendaModule,
    ExtratosModule,
    EventosModule,
    MetasModule,
    RelatoriosModule,
    PainelModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
