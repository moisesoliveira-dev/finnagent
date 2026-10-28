import { Module } from "@nestjs/common";
import { ConfiguracoesModule } from "../configuracoes/configuracoes.module.js";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaEventosRepositorio } from "./adaptadores/prisma-eventos-repositorio.js";
import { EventosService } from "./aplicacao/eventos.service.js";
import { EventosController } from "./eventos.controller.js";
import { EVENTOS_REPOSITORIO } from "./portas/eventos-repositorio.js";

@Module({
  imports: [PersistenciaModule, ConfiguracoesModule],
  controllers: [EventosController],
  providers: [
    PrismaEventosRepositorio,
    { provide: EVENTOS_REPOSITORIO, useExisting: PrismaEventosRepositorio },
    EventosService,
  ],
})
export class EventosModule {}
