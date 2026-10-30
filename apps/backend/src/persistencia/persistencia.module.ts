import { Module } from "@nestjs/common";
import { ConsumidoresDoOutbox } from "./consumidores-do-outbox.js";
import { OutboxPublicador } from "./outbox-publicador.js";
import { PrismaService } from "./prisma.service.js";

@Module({
  providers: [PrismaService, OutboxPublicador, ConsumidoresDoOutbox],
  exports: [PrismaService, ConsumidoresDoOutbox],
})
export class PersistenciaModule {}
