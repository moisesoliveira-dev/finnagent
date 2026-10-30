import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { log } from "../../log.js";
import { ConsumidoresDoOutbox } from "../../persistencia/consumidores-do-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { NotificacoesService } from "../aplicacao/notificacoes.service.js";
import { VarreduraService } from "../aplicacao/varredura.service.js";

const FILA = "notificacoes";
const A_CADA_MS = 5 * 60 * 1000;

/**
 * A borda das notificações com a fila: registra os consumidores do outbox (a entrega do push e o fim da leitura
 * do extrato) e agenda no BullMQ a varredura que gera os avisos por horário. Uma réplica só: o agendador do
 * BullMQ guarda o próximo disparo no Redis, então reiniciar o container não dobra a varredura.
 */
@Injectable()
export class AgendadorDeNotificacoes implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private conexoes: Redis[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly consumidores: ConsumidoresDoOutbox,
    private readonly notificacoes: NotificacoesService,
    private readonly varredura: VarreduraService,
  ) {}

  async onModuleInit() {
    this.consumidores.registrar("criar-notificacao", (evento) => this.notificacoes.entregarDoEvento(evento.tenantId, evento.payload));
    this.consumidores.registrar("importar-extrato", (evento) => this.varredura.extratoImportado(evento.tenantId, evento.payload));

    const url = process.env.REDIS_URL;
    if (!url || !this.prisma.ativo) return;
    try {
      this.queue = new Queue(FILA, { connection: this.abrirRedis(url) });
      this.worker = new Worker(FILA, () => this.varredura.varrer(), { connection: this.abrirRedis(url) });
      this.queue.on("error", registrarFalha);
      this.worker.on("error", registrarFalha);
      this.worker.on("failed", (_job, error) => registrarFalha(error));
      await this.queue.upsertJobScheduler("varrer-avisos", { every: A_CADA_MS }, { name: "varrer-avisos" });
    } catch (error) {
      registrarFalha(error);
    }
  }

  async onModuleDestroy() {
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
}

function registrarFalha(error: unknown) {
  log.error({ err: error instanceof Error ? error.message : String(error) }, "a fila das notificações falhou");
}
