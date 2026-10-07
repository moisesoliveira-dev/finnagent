import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AgendaModule } from './agenda/agenda.module.js';
import { ExtratosModule } from './extratos/extratos.module.js';
import { FinancasModule } from './financas/financas.module.js';
import { GruposModule } from './grupos/grupos.module.js';
import { PersistenciaModule } from './persistencia/persistencia.module.js';

@Module({
  imports: [PersistenciaModule, GruposModule, FinancasModule, AgendaModule, ExtratosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
