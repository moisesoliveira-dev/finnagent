import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AgendaModule } from './agenda/agenda.module.js';
import { AssistenteModule } from './assistente/assistente.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ContasModule } from "./contas/contas.module.js";
import { ConfiguracoesModule } from './configuracoes/configuracoes.module.js';
import { DadosModule } from './dados/dados.module.js';
import { ExclusoesModule } from "./exclusoes/exclusoes.module.js";
import { EventosModule } from './eventos/eventos.module.js';
import { FeriadosHttpModule } from './feriados/feriados-http.module.js';
import { ExtratosModule } from './extratos/extratos.module.js';
import { FinancasModule } from './financas/financas.module.js';
import { GruposModule } from './grupos/grupos.module.js';
import { MetasModule } from './metas/metas.module.js';
import { HojeModule } from "./hoje/hoje.module.js";
import { NotificacoesModule } from './notificacoes/notificacoes.module.js';
import { PainelModule } from './painel/painel.module.js';
import { PersistenciaModule } from './persistencia/persistencia.module.js';
import { RelatoriosModule } from './relatorios/relatorios.module.js';

@Module({
  imports: [
    SentryModule.forRoot(),
    PersistenciaModule,
    AuthModule,
    GruposModule,
    FinancasModule,
    ContasModule,
    FeriadosHttpModule,
    AgendaModule,
    ExtratosModule,
    ExclusoesModule,
    EventosModule,
    MetasModule,
    HojeModule,
    RelatoriosModule,
    PainelModule,
    ConfiguracoesModule,
    AssistenteModule,
    DadosModule,
    NotificacoesModule,
  ],
  controllers: [AppController],
  // O erro que escapa de um controlador vai para o Sentry e segue para a resposta padrão do Nest.
  providers: [AppService, { provide: APP_FILTER, useClass: SentryGlobalFilter }],
})
export class AppModule {}
