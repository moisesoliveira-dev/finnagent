import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { GRUPO_DAS_METAS, alocarSobra, totaisDoMes, type Meta, type MetasResposta } from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { GruposService } from "../../grupos/aplicacao/grupos.service.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { valorSeparado } from "../dominio/guardado.js";
import {
  METAS_REPOSITORIO,
  type MetasRepositorio,
  type NovaMeta,
} from "../portas/metas-repositorio.js";

type PedidoDaMeta = Omit<NovaMeta, "sessionId">;

@Injectable()
export class MetasService {
  constructor(
    @Inject(METAS_REPOSITORIO) private readonly metas: MetasRepositorio,
    private readonly financas: FinancasService,
    private readonly grupos: GruposService,
  ) {}

  async listar(tenantId: string): Promise<MetasResposta> {
    const situacao = await this.situacao(tenantId);
    const { goals, surplusCents, separatedCents, year, month } = situacao;
    const livre = Math.max(surplusCents, 0);
    const division: MetasResposta["division"] = {};
    for (const linha of await this.metas.divisoes(tenantId, year, month)) {
      const aprovada = linha.approvedCents !== null;
      division[linha.goalId] = {
        percent: linha.percent,
        approved: aprovada,
        cents: linha.approvedCents ?? Math.floor((livre * linha.percent) / 100),
      };
    }
    return {
      goals,
      surplusCents,
      separatedCents,
      suggested: alocarSobra(goals, { year, month }, surplusCents),
      division,
      year,
      month,
    };
  }

  /** A divisão da sobra deste mês, em porcentagem por meta. Nada é separado até a pessoa aprovar. */
  async dividir(tenantId: string, percentuais: Record<string, number>) {
    const { year, month } = await this.hoje(tenantId);
    const resultado = await this.metas.dividir(tenantId, year, month, percentuais);
    if (resultado === "meta-ausente") throw new NaoEncontrado("Meta não encontrada.");
  }

  /** Aprova a parte da meta: separa agora o valor da porcentagem sobre a sobra de hoje. */
  async aprovar(tenantId: string, id: string) {
    const { goals, surplusCents, year, month } = await this.situacao(tenantId);
    const meta = goals.find((item) => item.id === id);
    if (!meta) throw new NaoEncontrado("Meta não encontrada.");
    if (!meta.sessionId) throw new Conflito("Essa meta não tem sessão. Crie uma meta nova.");
    const divisao = (await this.metas.divisoes(tenantId, year, month)).find((linha) => linha.goalId === id);
    if (!divisao || divisao.percent === 0) throw new Conflito("Defina a porcentagem desta meta antes de aprovar.");
    const cents = Math.floor((Math.max(surplusCents, 0) * divisao.percent) / 100);
    if (cents <= 0) throw new Conflito("Não há sobra para aprovar neste mês.");
    const marcou = await this.metas.aprovar(tenantId, id, year, month, cents);
    if (marcou === "ja-aprovada") throw new Conflito("Essa meta já foi aprovada neste mês.");
    if (marcou === "sem-divisao") throw new Conflito("Defina a porcentagem desta meta antes de aprovar.");
    try {
      await this.lancarSeparado(tenantId, meta.sessionId, meta.name, cents);
    } catch (error) {
      await this.metas.reabrir(tenantId, id, year, month);
      throw error;
    }
  }

  private async hoje(tenantId: string) {
    const [year, month] = (await this.financas.hoje(tenantId)).split("-").map(Number) as [number, number];
    return { year, month };
  }

  private async situacao(tenantId: string) {
    const painel = await this.financas.listar(tenantId);
    // A sobra e o prazo contam a partir de hoje, não do início do workflow.
    const { year, month } = await this.hoje(tenantId);
    const gravadas = await this.metas.listar(tenantId);
    // O que a meta guarda é o que a sessão dela acumulou. Meta antiga, sem sessão, segue com o valor gravado.
    const goals = gravadas.map((meta) =>
      meta.sessionId ? { ...meta, savedCents: valorSeparado(painel.entries, meta.sessionId) } : meta,
    );
    // Tudo no grupo Metas é valor separado, inclusive o de meta já excluída, cuja sessão segue como histórico.
    const sessoes = new Set(goals.flatMap((meta) => (meta.sessionId ? [meta.sessionId] : [])));
    const ehDeMeta = (entry: { sessionId: string; groupName: string }) =>
      sessoes.has(entry.sessionId) || entry.groupName.toLowerCase() === GRUPO_DAS_METAS.toLowerCase();
    const dasMetas = painel.entries.filter(ehDeMeta);
    const dasOutras = painel.entries.filter((entry) => !ehDeMeta(entry));
    const surplusCents = totaisDoMes(dasOutras, painel.workflow, year, month - 1).sobra;
    const separatedCents = -totaisDoMes(dasMetas, painel.workflow, year, month - 1).sobra;
    return { goals, surplusCents, separatedCents: Math.max(separatedCents, 0), year, month };
  }

  async criar(tenantId: string, pedido: PedidoDaMeta) {
    const existente = (await this.metas.listar(tenantId)).find((meta) => meta.id === pedido.id);
    if (existente) return this.gravar(tenantId, { ...pedido, sessionId: existente.sessionId });

    const sessionId = await this.sessaoDaMeta(tenantId, pedido.name);
    const criada = await this.gravar(tenantId, { ...pedido, sessionId });
    if (pedido.savedCents > 0) await this.lancarSeparado(tenantId, sessionId, pedido.name, pedido.savedCents);
    return criada;
  }

  /** Separa um valor para a meta: uma saída lançada na sessão dela. */
  async separar(tenantId: string, id: string, cents: number) {
    const meta = (await this.metas.listar(tenantId)).find((item) => item.id === id);
    if (!meta) throw new NaoEncontrado("Meta não encontrada.");
    if (!meta.sessionId) throw new Conflito("Essa meta não tem sessão. Crie uma meta nova.");
    await this.lancarSeparado(tenantId, meta.sessionId, meta.name, cents);
  }

  /** A ordem de prioridade das metas: a primeira da lista recebe antes da sobra do mês. */
  async reordenar(tenantId: string, ids: string[]) {
    const resultado = await this.metas.reordenar(tenantId, ids);
    if (resultado === "diferente") throw new Conflito("A lista de metas mudou. Atualize a tela e organize de novo.");
  }

  async excluir(tenantId: string, id: string) {
    const meta = (await this.metas.listar(tenantId)).find((item) => item.id === id);
    const apagou = await this.metas.excluir(tenantId, id);
    if (!apagou) throw new NaoEncontrado("Meta não encontrada.");
    // A sessão da meta é encerrada, só se nunca recebeu valor; com lançamentos, segue aberta no grupo Metas como histórico.
    if (meta?.sessionId) {
      const { entries } = await this.financas.listar(tenantId);
      if (!entries.some((entry) => entry.sessionId === meta.sessionId)) {
        await this.grupos.removerSessao(tenantId, meta.sessionId).catch(() => undefined);
      }
    }
  }

  private async gravar(tenantId: string, pedido: NovaMeta): Promise<Meta> {
    const criada = await this.metas.criar(tenantId, pedido);
    if (criada === "identificador") {
      throw new Conflito("Este identificador já pertence a outra meta.");
    }
    return criada;
  }

  // O grupo "Metas" nasce na primeira meta; cada meta é uma sessão de acúmulo nele.
  private async sessaoDaMeta(tenantId: string, nome: string) {
    const { groups } = await this.grupos.listar(tenantId);
    const existente = groups.find((grupo) => grupo.name.toLowerCase() === GRUPO_DAS_METAS.toLowerCase());
    const groupId =
      existente?.id ??
      (await this.grupos.criarGrupo(tenantId, randomUUID(), GRUPO_DAS_METAS, "O valor separado para cada meta.")).id;
    const sessionId = randomUUID();
    try {
      await this.grupos.criarSessao(
        tenantId,
        sessionId,
        { groupId, name: nome, description: "", justification: "Valor separado para a meta." },
        "acumulo",
      );
    } catch (error) {
      if (error instanceof Conflito) throw new Conflito("Já existe uma meta com esse nome.");
      throw error;
    }
    return sessionId;
  }

  private async lancarSeparado(tenantId: string, sessionId: string, meta: string, cents: number) {
    await this.financas.registrar(tenantId, {
      id: randomUUID(),
      sessionId,
      name: `Separado para ${meta}`.slice(0, 160),
      description: "",
      justification: "",
      date: await this.financas.hoje(tenantId),
      mode: "outflows",
      status: "completed",
      transactionType: "unusual",
      category: "unique",
      priority: "nopriority",
      cents,
      installments: null,
      installmentNumber: null,
      dueDate: null,
      interestRate: null,
      nextDueDate: null,
      recurrence: null,
      recurrenceInterval: null,
      dueRule: null,
    });
  }
}
