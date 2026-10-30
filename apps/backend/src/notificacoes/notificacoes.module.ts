import { Module } from "@nestjs/common";
import { AgendaModule } from "../agenda/agenda.module.js";
import { AssistenteModule } from "../assistente/assistente.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { ConfiguracoesModule } from "../configuracoes/configuracoes.module.js";
import { ExtratosModule } from "../extratos/extratos.module.js";
import { FinancasModule } from "../financas/financas.module.js";
import { MetasModule } from "../metas/metas.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { AgendadorDeNotificacoes } from "./adaptadores/agendador.js";
import { FirebasePush } from "./adaptadores/firebase.js";
import { PrismaNotificacoesRepositorio } from "./adaptadores/prisma-notificacoes-repositorio.js";
import { WebPush } from "./adaptadores/web-push.js";
import { NotificacoesService } from "./aplicacao/notificacoes.service.js";
import { VarreduraService } from "./aplicacao/varredura.service.js";
import { NotificacoesController } from "./notificacoes.controller.js";
import { PUSH_DO_CELULAR, PUSH_DO_NAVEGADOR } from "./portas/canal-de-push.js";
import { NOTIFICACOES_REPOSITORIO } from "./portas/notificacoes-repositorio.js";

/**
 * A central de notificações. Lê as outras slices pelos serviços delas e nenhuma delas depende desta:
 * os avisos nascem da varredura agendada e dos eventos do outbox.
 */
@Module({
  imports: [
    PersistenciaModule,
    AuthModule,
    ConfiguracoesModule,
    FinancasModule,
    AgendaModule,
    ExtratosModule,
    MetasModule,
    AssistenteModule,
  ],
  controllers: [NotificacoesController],
  providers: [
    PrismaNotificacoesRepositorio,
    { provide: NOTIFICACOES_REPOSITORIO, useExisting: PrismaNotificacoesRepositorio },
    WebPush,
    { provide: PUSH_DO_NAVEGADOR, useExisting: WebPush },
    FirebasePush,
    { provide: PUSH_DO_CELULAR, useExisting: FirebasePush },
    NotificacoesService,
    VarreduraService,
    AgendadorDeNotificacoes,
  ],
})
export class NotificacoesModule {}
