import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { log } from "../../log.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { ExtratosService } from "../aplicacao/extratos.service.js";

const FILA = "extratos";
const DESFAZER = "desfazer-conferencia";

export type PedidoDeDesfazer = { tenantId: string; userId: string | null };

/**
 * Desfazer toda a conferência leva segundos por linha (cada uma é várias idas ao banco), e a tela desiste em um
 * minuto. Por isso roda aqui, na fila do BullMQ: a tela recebe "começou" na hora, e a pessoa é avisada pela central
 * quando termina. Um trabalho por conta de cada vez: o id do trabalho é a conta, e o BullMQ não aceita o mesmo id
 * enquanto o anterior está na fila ou rodando.
 */
@Injectable()
export class FilaDeConferencia implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<PedidoDeDesfazer> | null = null;
  private worker: Worker<PedidoDeDesfazer> | null = null;
  private conexoes: Redis[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly extratos: ExtratosService,
  ) {}

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url || !this.prisma.ativo) return;
    try {
      this.queue = new Queue(FILA, { connection: this.abrirRedis(url) });
      this.worker = new Worker<PedidoDeDesfazer>(FILA, (job) => this.rodar(job.name, job.data), { connection: this.abrirRedis(url) });
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

  /**
   * Põe o desfazer na fila. "ja-rodando": o anterior desta conta ainda não terminou. "sem-fila": não há Redis,
   * e quem chamou faz na hora.
   */
  async desfazerConferencia(pedido: PedidoDeDesfazer): Promise<"enfileirado" | "ja-rodando" | "sem-fila"> {
    if (!this.queue) return "sem-fila";
    // O id do trabalho não aceita dois-pontos no BullMQ.
    const jobId = `${DESFAZER}-${pedido.tenantId}`;
    const anterior = await this.queue.getJob(jobId);
    if (anterior) {
      const estado = await anterior.getState();
      if (estado === "active" || estado === "waiting" || estado === "delayed" || estado === "prioritized") return "ja-rodando";
      // Terminou (ou falhou) e ainda não saiu da fila: dá lugar ao novo.
      await anterior.remove().catch(() => undefined);
    }
    await this.queue.add(DESFAZER, pedido, { jobId, removeOnComplete: true, removeOnFail: true });
    log.info({ tenant: pedido.tenantId }, "desfazer a conferência entrou na fila");
    return "enfileirado";
  }

  private async rodar(nome: string, pedido: PedidoDeDesfazer) {
    if (nome !== DESFAZER) return;
    const inicio = Date.now();
    try {
      const resultado = await this.extratos.desfazerConferencia(pedido.tenantId, pedido.userId);
      log.info({ tenant: pedido.tenantId, ms: Date.now() - inicio, ...resultado }, "conferência desfeita pela fila");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      log.error({ tenant: pedido.tenantId, ms: Date.now() - inicio, err: mensagem }, "desfazer a conferência falhou na fila");
      // A pessoa fica sabendo pela central, pelo mesmo caminho do aviso de concluído.
      await this.extratos.registrarFalhaAoDesfazer(pedido.tenantId, pedido.userId, mensagem).catch(() => undefined);
      throw error;
    }
  }

  private abrirRedis(url: string) {
    const conexao = new Redis(url, { maxRetriesPerRequest: null });
    conexao.on("error", registrarFalha);
    this.conexoes.push(conexao);
    return conexao;
  }
}

function registrarFalha(error: unknown) {
  log.error({ err: error instanceof Error ? error.message : String(error) }, "a fila dos extratos falhou");
}
