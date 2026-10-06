import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { PrismaService } from "./prisma.service.js";

const fila = "outbox";

@Injectable()
export class OutboxPublicador implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url || !this.prisma.ativo) return;
    const connection = { url, maxRetriesPerRequest: null };
    this.queue = new Queue(fila, { connection });
    this.worker = new Worker(
      fila,
      async (job) => {
        const idempotencyKey = String(job.data.idempotencyKey);
        const tenantId = String(job.data.tenantId);
        try {
          await this.prisma.consumedEvent.create({
            data: { idempotencyKey, tenantId },
          });
        } catch (error) {
          if (!temCodigo(error, "P2002")) throw error;
        }
      },
      { connection },
    );
    void this.publicar();
    this.timer = setInterval(() => {
      void this.publicar();
    }, 2000);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }

  private async publicar() {
    if (!this.queue || !this.prisma.ativo) return;
    const pendentes = await this.prisma.outbox.findMany({
      where: { publishedAt: null },
      orderBy: { id: "asc" },
      take: 20,
    });
    for (const evento of pendentes) {
      await this.queue.add(
        evento.operation,
        {
          tenantId: evento.tenantId,
          idempotencyKey: evento.idempotencyKey,
        },
        { jobId: evento.id },
      );
      await this.prisma.outbox.update({
        where: { id: evento.id },
        data: { publishedAt: new Date() },
      });
    }
  }
}

function temCodigo(error: unknown, codigo: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === codigo
  );
}
