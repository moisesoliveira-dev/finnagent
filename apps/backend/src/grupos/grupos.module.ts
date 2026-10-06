import { Module } from "@nestjs/common";
import { GruposService } from "./aplicacao/grupos.service.js";
import { OutboxPublicador } from "./adaptadores/outbox-publicador.js";
import { PrismaGruposRepositorio } from "./adaptadores/prisma-grupos-repositorio.js";
import { PrismaService } from "./adaptadores/prisma.service.js";
import { GruposController } from "./grupos.controller.js";
import { GRUPOS_REPOSITORIO } from "./portas/grupos-repositorio.js";

@Module({
  controllers: [GruposController],
  providers: [
    PrismaService,
    PrismaGruposRepositorio,
    { provide: GRUPOS_REPOSITORIO, useExisting: PrismaGruposRepositorio },
    GruposService,
    OutboxPublicador,
  ],
})
export class GruposModule {}
