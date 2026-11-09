import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  GRUPO_DAS_CAIXINHAS,
  resumoDaCaixinha,
  type Caixinha,
  type CaixinhaDaMeta,
  type Lancamento,
  type PedidoDeCaixinha,
  type PedidoDeMovimentoNaCaixinha,
} from "@finnagent/contracts";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { GruposService } from "../../grupos/aplicacao/grupos.service.js";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { CAIXINHAS_REPOSITORIO, type CaixinhasRepositorio, type FalhaDaCaixinha } from "../portas/caixinhas-repositorio.js";
import { CONTAS_REPOSITORIO, type ContasRepositorio } from "../portas/contas-repositorio.js";

const FALHAS: Record<FalhaDaCaixinha, string> = {
  "nome-ocupado": "Esta conta já tem uma caixinha com esse nome.",
  "meta-ausente": "Meta não encontrada.",
  "meta-ocupada": "Essa meta já guarda em outra caixinha.",
};

const MENSAGEM_DO_CARTAO = "Cartão de crédito não tem caixinha. Crie a caixinha na conta do banco.";

/**
 * As caixinhas (depósitos) de cada conta. Cada caixinha nasce com uma sessão de acúmulo no grupo "Caixinhas": nela a
 * pessoa lança o quanto rendeu no mês, e as aplicações e os resgates entre a conta e a caixinha.
 */
@Injectable()
export class CaixinhasService {
  constructor(
    @Inject(CAIXINHAS_REPOSITORIO) private readonly caixinhas: CaixinhasRepositorio,
    @Inject(CONTAS_REPOSITORIO) private readonly contas: ContasRepositorio,
    private readonly grupos: GruposService,
    private readonly financas: FinancasService,
  ) {}

  listar(tenantId: string) {
    return this.caixinhas.listar(tenantId);
  }

  async criar(tenantId: string, accountId: string, id: string, pedido: PedidoDeCaixinha) {
    const existente = await this.caixinhas.obter(tenantId, id);
    if (existente) return this.gravar(tenantId, { ...pedido, id, accountId, sessionId: existente.sessionId });
    const conta = (await this.contas.listar(tenantId)).find((item) => item.id === accountId);
    if (!conta) throw new NaoEncontrado("Conta não encontrada.");
    if (conta.kind === "cartao") throw new Conflito(MENSAGEM_DO_CARTAO);
    const mesmoNome = (await this.caixinhas.listar(tenantId)).some(
      (item) => item.accountId === accountId && item.name.toLowerCase() === pedido.name.toLowerCase(),
    );
    if (mesmoNome) throw new Conflito(FALHAS["nome-ocupado"]);
    const sessionId = await this.criarSessao(tenantId, nomeDaSessao(pedido.name, conta.name));
    try {
      return await this.gravar(tenantId, { id, accountId, sessionId, ...pedido });
    } catch (error) {
      await this.grupos.removerSessao(tenantId, sessionId).catch(() => undefined);
      throw error;
    }
  }

  async atualizar(tenantId: string, id: string, pedido: PedidoDeCaixinha) {
    const atual = await this.caixinhas.obter(tenantId, id);
    if (!atual) throw new NaoEncontrado("Caixinha não encontrada.");
    const resultado = await this.caixinhas.atualizar(tenantId, id, pedido);
    if (resultado === "ausente") throw new NaoEncontrado("Caixinha não encontrada.");
    if (typeof resultado === "string") throw new Conflito(FALHAS[resultado]);
    if (atual.name !== pedido.name) await this.renomearSessao(tenantId, resultado).catch(() => undefined);
    return resultado;
  }

  /** Liga a meta a uma caixinha, ou tira a ligação (boxId null). */
  async ligarMeta(tenantId: string, goalId: string, boxId: string | null) {
    const resultado = await this.caixinhas.ligarMeta(tenantId, goalId, boxId);
    if (resultado === "ausente") throw new NaoEncontrado("Caixinha não encontrada.");
    if (resultado === "meta-ausente") throw new NaoEncontrado("Meta não encontrada.");
  }

  /** Apaga a caixinha. A sessão dela sai junto se nunca recebeu lançamento; com lançamentos, fica como histórico. */
  async excluir(tenantId: string, id: string) {
    const apagada = await this.caixinhas.excluir(tenantId, id);
    if (apagada === "ausente") throw new NaoEncontrado("Caixinha não encontrada.");
    const { entries } = await this.financas.listar(tenantId, true);
    if (!entries.some((entry) => entry.sessionId === apagada.sessionId)) {
      await this.grupos.removerSessao(tenantId, apagada.sessionId).catch(() => undefined);
    }
  }

  /**
   * Lança um movimento na sessão da caixinha. Rendimento é entrada sem conta: soma na caixinha e na sobra do mês.
   * Aplicação sai da conta e entra na caixinha; resgate faz o contrário. Na caixinha comum, os dois são transferência
   * (não mexem na sobra). Na caixinha de uma meta, a aplicação é o valor separado para a meta e sai da sobra, como o
   * separado das metas; o resgate volta para a sobra.
   */
  async movimentar(tenantId: string, id: string, pedido: PedidoDeMovimentoNaCaixinha) {
    const caixinha = await this.caixinhas.obter(tenantId, id);
    if (!caixinha) throw new NaoEncontrado("Caixinha não encontrada.");
    const rendimento = pedido.tipo === "rendimento";
    const nome = rendimento
      ? `${pedido.cents < 0 ? "Perda" : "Rendimento"} da caixinha ${caixinha.name}`
      : pedido.tipo === "aplicacao"
        ? `Aplicação na caixinha ${caixinha.name}`
        : `Resgate da caixinha ${caixinha.name}`;
    const entrada = rendimento ? pedido.cents > 0 : pedido.tipo === "resgate";
    return this.financas.registrar(tenantId, {
      id: randomUUID(),
      sessionId: caixinha.sessionId,
      name: nome.slice(0, 160),
      description: "",
      justification: "",
      date: pedido.date,
      mode: entrada ? "inflows" : "outflows",
      status: "completed",
      transactionType: "unusual",
      category: "unique",
      priority: "nopriority",
      cents: Math.abs(pedido.cents),
      installments: null,
      installmentNumber: null,
      dueDate: null,
      interestRate: null,
      nextDueDate: null,
      recurrence: null,
      recurrenceInterval: null,
      dueRule: null,
      accountId: rendimento ? null : caixinha.accountId,
      transfer: !rendimento && !caixinha.goalId,
    });
  }

  /** A caixinha de cada meta, com o saldo de hoje: o guardado da meta soma esse saldo. */
  async dasMetas(tenantId: string, entries: Lancamento[], hoje: string) {
    const [caixinhas, contas] = await Promise.all([this.caixinhas.listar(tenantId), this.contas.listar(tenantId)]);
    const nomes = new Map(contas.map((conta) => [conta.id, conta.name]));
    const porMeta = new Map<string, CaixinhaDaMeta & { sessionId: string }>();
    for (const caixinha of caixinhas) {
      if (!caixinha.goalId) continue;
      porMeta.set(caixinha.goalId, {
        id: caixinha.id,
        name: caixinha.name,
        accountId: caixinha.accountId,
        accountName: nomes.get(caixinha.accountId) ?? "",
        saldoCents: resumoDaCaixinha(caixinha, entries, hoje).saldoCents,
        sessionId: caixinha.sessionId,
      });
    }
    return porMeta;
  }

  /** A caixinha que usa alguma destas sessões, se houver. */
  async daSessao(tenantId: string, sessionIds: string[]) {
    return (await this.caixinhas.listar(tenantId)).find((caixinha) => sessionIds.includes(caixinha.sessionId)) ?? null;
  }

  private async gravar(tenantId: string, caixinha: Caixinha) {
    const resultado = await this.caixinhas.criar(tenantId, caixinha);
    if (resultado === "identificador") throw new Conflito("Esse identificador já pertence a outra caixinha.");
    if (resultado === "conta-ausente") throw new NaoEncontrado("Conta não encontrada.");
    if (resultado === "cartao") throw new Conflito(MENSAGEM_DO_CARTAO);
    if (typeof resultado === "string") throw new Conflito(FALHAS[resultado]);
    return resultado;
  }

  // O grupo "Caixinhas" nasce na primeira caixinha; cada caixinha é uma sessão de acúmulo nele.
  private async criarSessao(tenantId: string, nome: string) {
    const groupId = await this.grupoDasCaixinhas(tenantId);
    const sessionId = randomUUID();
    try {
      await this.grupos.criarSessao(
        tenantId,
        sessionId,
        { groupId, name: nome, description: "", justification: "Rendimento, aplicações e resgates da caixinha." },
        "acumulo",
      );
    } catch (error) {
      if (error instanceof Conflito) throw new Conflito("Já existe uma sessão com o nome desta caixinha no grupo Caixinhas.");
      throw error;
    }
    return sessionId;
  }

  private async grupoDasCaixinhas(tenantId: string) {
    const { groups } = await this.grupos.listar(tenantId);
    const existente = groups.find((grupo) => grupo.name.toLowerCase() === GRUPO_DAS_CAIXINHAS.toLowerCase());
    if (existente) return existente.id;
    const criado = await this.grupos.criarGrupo(tenantId, randomUUID(), GRUPO_DAS_CAIXINHAS, "Uma sessão por caixinha: o rendimento de cada mês.");
    return criado.id;
  }

  private async renomearSessao(tenantId: string, caixinha: Caixinha) {
    const { sessions } = await this.grupos.listar(tenantId);
    const sessao = sessions.find((item) => item.id === caixinha.sessionId);
    if (!sessao) return;
    const conta = (await this.contas.listar(tenantId)).find((item) => item.id === caixinha.accountId);
    await this.grupos.atualizarSessao(tenantId, sessao.id, {
      groupId: sessao.groupId,
      name: nomeDaSessao(caixinha.name, conta?.name ?? ""),
      description: sessao.description,
      justification: sessao.justification,
    });
  }
}

/** A sessão leva o nome da caixinha e da conta: duas contas podem ter uma caixinha com o mesmo nome. */
export function nomeDaSessao(caixinha: string, conta: string) {
  return (conta ? `${caixinha} · ${conta}` : caixinha).slice(0, 80);
}
