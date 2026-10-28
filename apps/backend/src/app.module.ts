import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AgendaModule } from './agenda/agenda.module.js';
import { AssistenteModule } from './assistente/assistente.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfiguracoesModule } from './configuracoes/configuracoes.module.js';
import { DadosModule } from './dados/dados.module.js';
import { EventosModule } from './eventos/eventos.module.js';
import { FeriadosHttpModule } from './feriados/feriados-http.module.js';
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
    AuthModule,
    GruposModule,
    FinancasModule,
    FeriadosHttpModule,
    AgendaModule,
    ExtratosModule,
    EventosModule,
    MetasModule,
    RelatoriosModule,
    PainelModule,
    ConfiguracoesModule,
    AssistenteModule,
    DadosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
