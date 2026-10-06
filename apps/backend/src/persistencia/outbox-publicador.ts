import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { PrismaService } from "./prisma.service.js";

const fila = "outbox";

@Injectable()
export class OutboxPublicador implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private conexoes: Redis[] = [];

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url || !this.prisma.ativo) return;
    try {
      const conexaoFila = this.abrirRedis(url);
      const conexaoWorker = this.abrirRedis(url);
      this.queue = new Queue(fila, { connection: conexaoFila });
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
        { connection: conexaoWorker },
      );
      this.queue.on("error", registrarFalha);
      this.worker.on("error", registrarFalha);
    } catch (error) {
      registrarFalha(error);
      void this.queue?.close();
      void this.worker?.close();
      this.queue = null;
      this.worker = null;
      const conexoes = this.conexoes.splice(0);
      for (const conexao of conexoes) void conexao.quit();
      return;
    }
    void this.publicar();
    this.timer = setInterval(() => {
      void this.publicar();
    }, 2000);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
    await Promise.all(this.conexoes.map((conexao) => conexao.quit()));
  }

  private abrirRedis(url: string) {
    const conexao = new Redis(url, { maxRetriesPerRequest: null });
    conexao.on("error", registrarFalha);
    this.conexoes.push(conexao);
    return conexao;
  }

  private async publicar() {
    if (!this.queue || !this.prisma.ativo) return;
    try {
      await this.enviarPendentes();
    } catch (error) {
      registrarFalha(error);
    }
  }

  private async enviarPendentes() {
    const queue = this.queue;
    if (!queue) return;
    const pendentes = await this.prisma.outbox.findMany({
      where: { publishedAt: null },
      orderBy: { id: "asc" },
      take: 20,
    });
    for (const evento of pendentes) {
      await queue.add(
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

function registrarFalha(error: unknown) {
  console.error("O publicador do outbox não publicou.", error);
}

function temCodigo(error: unknown, codigo: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === codigo
  );
}
