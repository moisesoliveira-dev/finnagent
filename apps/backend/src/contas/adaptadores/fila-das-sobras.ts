import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { operacoesQueMudamASobra } from "@finnagent/contracts";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { log } from "../../log.js";
import { ConsumidoresDoOutbox } from "../../persistencia/consumidores-do-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { SobrasService } from "../aplicacao/sobras.service.js";

const FILA = "sobras";
const ESPERA_MS = 3000;

/**
 * Recalcula as sobras levadas de mês em mês depois de cada mudança nos lançamentos. Um lote de cem linhas do extrato
 * gera cem eventos: o trabalho espera três segundos com o id da conta, e os eventos que chegam nesse tempo caem no
 * mesmo trabalho. Sem Redis, recalcula na hora.
 */
@Injectable()
export class FilaDasSobras implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<{ tenantId: string }> | null = null;
  private worker: Worker<{ tenantId: string }> | null = null;
  private conexoes: Redis[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly consumidores: ConsumidoresDoOutbox,
    private readonly sobras: SobrasService,
  ) {}

  onModuleInit() {
    for (const operacao of operacoesQueMudamASobra()) {
      this.consumidores.registrar(operacao, (evento) => this.pedir(evento.tenantId));
    }
    const url = process.env.REDIS_URL;
    if (!url || !this.prisma.ativo) return;
    try {
      this.queue = new Queue(FILA, { connection: this.abrirRedis(url) });
      this.worker = new Worker<{ tenantId: string }>(FILA, (job) => this.sobras.atualizar(job.data.tenantId), { connection: this.abrirRedis(url) });
      this.queue.on("error", registrarFalha);
      this.worker.on("error", registrarFalha);
      this.worker.on("failed", (_job, error) => registrarFalha(error));
    } catch (error) {
      registrarFalha(error);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await Promise.all(this.conexoes.map((conexao) => conexao.quit()));
  }

  /** Agenda o recálculo da conta. O id do trabalho não aceita dois-pontos no BullMQ. */
  async pedir(tenantId: string) {
    if (!this.queue) {
      await this.sobras.atualizar(tenantId);
      return;
    }
    const jobId = `sobras-${tenantId}`;
    const anterior = await this.queue.getJob(jobId);
    if (anterior) {
      const estado = await anterior.getState();
      if (estado === "delayed" || estado === "waiting") return;
      await anterior.remove().catch(() => undefined);
    }
    await this.queue.add("atualizar", { tenantId }, { jobId, delay: ESPERA_MS, removeOnComplete: true, removeOnFail: true });
  }

  private abrirRedis(url: string) {
    const conexao = new Redis(url, { maxRetriesPerRequest: null });
    conexao.on("error", registrarFalha);
    this.conexoes.push(conexao);
    return conexao;
  }
}

function registrarFalha(error: unknown) {
  log.error({ err: error }, "fila das sobras");
}
