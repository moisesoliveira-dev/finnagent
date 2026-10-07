import { Module } from "@nestjs/common";
import { OutboxPublicador } from "./outbox-publicador.js";
import { PrismaService } from "./prisma.service.js";

@Module({
  providers: [PrismaService, OutboxPublicador],
  exports: [PrismaService],
})
export class PersistenciaModule {}
