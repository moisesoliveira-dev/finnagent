import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { GRUPO_DAS_METAS, alocarSobra, sobraAcumulada, totaisDoMes, type Meta, type MetasResposta } from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { GruposService } from "../../grupos/aplicacao/grupos.service.js";
import { CaixinhasService } from "../../contas/aplicacao/caixinhas.service.js";
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
    private readonly caixinhas: CaixinhasService,
  ) {}

  async listar(tenantId: string): Promise<MetasResposta> {
    const situacao = await this.situacao(tenantId);
    const { goals, surplusCents, monthSurplusCents, carriedCents, separatedCents, year, month } = situacao;
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
      monthSurplusCents,
      carriedCents,
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
      await this.lancarSeparado(tenantId, meta, cents);
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
    const hoje = await this.financas.hoje(tenantId);
    const caixinhas = await this.caixinhas.dasMetas(tenantId, painel.entries, hoje);
    // O que a meta guarda é o que a sessão dela acumulou, mais o saldo da caixinha ligada a ela. Meta antiga, sem
    // sessão, segue com o valor gravado.
    const goals: Meta[] = gravadas.map((meta) => {
      const caixinha = caixinhas.get(meta.id);
      const box = caixinha
        ? { id: caixinha.id, name: caixinha.name, accountId: caixinha.accountId, accountName: caixinha.accountName, saldoCents: caixinha.saldoCents }
        : null;
      const separado = meta.sessionId ? valorSeparado(painel.entries, meta.sessionId) : meta.savedCents;
      return { ...meta, savedCents: separado + (box?.saldoCents ?? 0), box };
    });
    // Tudo no grupo Metas é valor separado, inclusive o de meta já excluída, cuja sessão segue como histórico. Na
    // caixinha de uma meta, a aplicação e o resgate (os lançamentos com conta) também são valor separado; o rendimento
    // dela é entrada do mês, como qualquer rendimento.
    const sessoes = new Set(goals.flatMap((meta) => (meta.sessionId ? [meta.sessionId] : [])));
    const dasCaixinhas = new Set([...caixinhas.values()].map((caixinha) => caixinha.sessionId));
    const ehDeMeta = (entry: { sessionId: string; groupName: string; accountId?: string | null }) =>
      sessoes.has(entry.sessionId) ||
      entry.groupName.toLowerCase() === GRUPO_DAS_METAS.toLowerCase() ||
      (dasCaixinhas.has(entry.sessionId) && Boolean(entry.accountId));
    const dasMetas = painel.entries.filter(ehDeMeta);
    const dasOutras = painel.entries.filter((entry) => !ehDeMeta(entry));
    const monthSurplusCents = totaisDoMes(dasOutras, painel.workflow, year, month - 1).sobra;
    const separatedCents = -totaisDoMes(dasMetas, painel.workflow, year, month - 1).sobra;
    // O que sobrou até o mês passado passa para este: o separado para metas lá já saiu como saída.
    const anterior = month === 1 ? { year: year - 1, monthIndex: 11 } : { year, monthIndex: month - 2 };
    const carriedCents = sobraAcumulada(painel.entries, painel.workflow, anterior.year, anterior.monthIndex);
    return {
      goals,
      surplusCents: carriedCents + monthSurplusCents,
      monthSurplusCents,
      carriedCents,
      separatedCents: Math.max(separatedCents, 0),
      year,
      month,
    };
  }

  async criar(tenantId: string, pedido: PedidoDaMeta) {
    const existente = (await this.metas.listar(tenantId)).find((meta) => meta.id === pedido.id);
    if (existente) return this.gravar(tenantId, { ...pedido, sessionId: existente.sessionId });

    const sessionId = await this.sessaoDaMeta(tenantId, pedido.name);
    const criada = await this.gravar(tenantId, { ...pedido, sessionId });
    if (pedido.savedCents > 0) await this.lancarSeparado(tenantId, criada, pedido.savedCents);
    return criada;
  }

  /** Liga a meta a uma caixinha (o saldo dela soma no guardado e o separado vai para ela), ou desfaz com null. */
  async ligarCaixinha(tenantId: string, id: string, boxId: string | null) {
    await this.caixinhas.ligarMeta(tenantId, id, boxId);
  }

  /** Separa um valor para a meta: uma saída lançada na sessão dela. */
  async separar(tenantId: string, id: string, cents: number) {
    const meta = (await this.metas.listar(tenantId)).find((item) => item.id === id);
    if (!meta) throw new NaoEncontrado("Meta não encontrada.");
    await this.lancarSeparado(tenantId, meta, cents);
  }

  /** A ordem de prioridade das metas: a primeira da lista recebe antes da sobra do mês. */
  async reordenar(tenantId: string, ids: string[]) {
    const resultado = await this.metas.reordenar(tenantId, ids);
    if (resultado === "diferente") throw new Conflito("A lista de metas mudou. Atualize a tela e organize de novo.");
  }

  /** A meta que guarda o valor em alguma destas sessões, se houver. */
  async metaDasSessoes(tenantId: string, sessionIds: string[]) {
    const metas = await this.metas.listar(tenantId);
    return metas.find((meta) => meta.sessionId !== null && sessionIds.includes(meta.sessionId)) ?? null;
  }

  /**
   * Apaga a meta e devolve o que foi apagado. A sessão dela é encerrada por quem chama (Exclusões), que antes solta
   * as linhas de extrato ligadas a ela.
   */
  async excluir(tenantId: string, id: string) {
    const meta = (await this.metas.listar(tenantId)).find((item) => item.id === id);
    const apagou = await this.metas.excluir(tenantId, id);
    if (!apagou || !meta) throw new NaoEncontrado("Meta não encontrada.");
    return meta;
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

  /**
   * Separa o valor para a meta. Com caixinha ligada, o dinheiro vai de verdade para ela: uma aplicação que sai da
   * conta e da sobra. Sem caixinha, uma saída na sessão da meta.
   */
  private async lancarSeparado(tenantId: string, meta: Pick<Meta, "id" | "name" | "sessionId">, cents: number) {
    const caixinha = (await this.caixinhas.listar(tenantId)).find((item) => item.goalId === meta.id);
    if (caixinha) {
      await this.caixinhas.movimentar(tenantId, caixinha.id, { tipo: "aplicacao", cents, date: await this.financas.hoje(tenantId) });
      return;
    }
    if (!meta.sessionId) throw new Conflito("Essa meta não tem sessão. Crie uma meta nova.");
    await this.financas.registrar(tenantId, {
      id: randomUUID(),
      sessionId: meta.sessionId,
      name: `Separado para ${meta.name}`.slice(0, 160),
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
