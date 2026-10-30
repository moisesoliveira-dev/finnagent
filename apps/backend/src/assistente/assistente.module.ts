import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ConfiguracoesModule } from "../configuracoes/configuracoes.module.js";
import { FeriadosModule } from "../feriados/feriados.module.js";
import { FinancasModule } from "../financas/financas.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { ContextoDoSistema } from "./adaptadores/contexto-do-sistema.js";
import { ExecutorHttp } from "./adaptadores/executor-http.js";
import { MotorHttp } from "./adaptadores/motor-http.js";
import { PrismaConversasRepositorio } from "./adaptadores/prisma-conversas-repositorio.js";
import { PrismaIaRepositorio } from "./adaptadores/prisma-ia-repositorio.js";
import { RealidadeDoSistema } from "./adaptadores/realidade-do-sistema.js";
import { AssistenteService } from "./aplicacao/assistente.service.js";
import { IaService } from "./aplicacao/ia.service.js";
import { AssistenteController } from "./assistente.controller.js";
import { IaController } from "./ia.controller.js";
import { CONTEXTO_DO_ASSISTENTE } from "./portas/contexto-do-assistente.js";
import { CONVERSAS_REPOSITORIO } from "./portas/conversas-repositorio.js";
import { EXECUTOR_DE_FERRAMENTAS } from "./portas/executor-de-ferramentas.js";
import { IA_REPOSITORIO } from "./portas/ia-repositorio.js";
import { MOTOR_DE_IA } from "./portas/motor-de-ia.js";
import { REALIDADE_DA_CONTA } from "./portas/realidade-da-conta.js";

@Module({
  imports: [PersistenciaModule, ConfiguracoesModule, AuthModule, FinancasModule, FeriadosModule],
  controllers: [AssistenteController, IaController],
  exports: [IaService, AssistenteService],
  providers: [
    PrismaIaRepositorio,
    { provide: IA_REPOSITORIO, useExisting: PrismaIaRepositorio },
    PrismaConversasRepositorio,
    { provide: CONVERSAS_REPOSITORIO, useExisting: PrismaConversasRepositorio },
    MotorHttp,
    { provide: MOTOR_DE_IA, useExisting: MotorHttp },
    ExecutorHttp,
    { provide: EXECUTOR_DE_FERRAMENTAS, useExisting: ExecutorHttp },
    ContextoDoSistema,
    { provide: CONTEXTO_DO_ASSISTENTE, useExisting: ContextoDoSistema },
    RealidadeDoSistema,
    { provide: REALIDADE_DA_CONTA, useExisting: RealidadeDoSistema },
    IaService,
    AssistenteService,
  ],
})
export class AssistenteModule {}
