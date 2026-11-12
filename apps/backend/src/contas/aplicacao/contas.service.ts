import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  evolucaoDoPatrimonio,
  patrimonio,
  resumoDaCaixinha,
  primeiroSaldoInformado,
  type SaldosResposta,
  GRUPO_DAS_TRANSFERENCIAS,
  GRUPO_DOS_AJUSTES,
  SESSAO_DAS_TRANSFERENCIAS,
  SESSAO_DOS_AJUSTES,
  faturasDoCartao,
  limiteDoCartao,
  resumoDaConta,
  type AjusteDeSaldo,
  type ContasResposta,
  type FaturasResposta,
  type PagamentoDaFatura,
  type ParDeTransferencia,
  type PedidoDeAjusteDeSaldo,
  type PedidoDeConta,
  type PedidoDePagamentoDaFatura,
  type PedidoDeTransferencia,
} from "@finnagent/contracts";
import type { PedidoLancamento } from "../../financas/dominio/pedido.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { GruposService } from "../../grupos/aplicacao/grupos.service.js";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { CAIXINHAS_REPOSITORIO, type CaixinhasRepositorio } from "../portas/caixinhas-repositorio.js";
import { CONTAS_REPOSITORIO, type ContasRepositorio } from "../portas/contas-repositorio.js";

const NOME_DO_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** As contas da pessoa: banco, carteira e cartão. O extrato já criava a conta pelo nome; aqui ela ganha tipo e saldo inicial. */
@Injectable()
export class ContasService {
  constructor(
    @Inject(CONTAS_REPOSITORIO) private readonly contas: ContasRepositorio,
    @Inject(CAIXINHAS_REPOSITORIO) private readonly caixinhas: CaixinhasRepositorio,
    private readonly financas: FinancasService,
    private readonly grupos: GruposService,
  ) {}

  async listar(tenantId: string): Promise<ContasResposta> {
    const [accounts, boxes] = await Promise.all([this.contas.listar(tenantId), this.caixinhas.listar(tenantId)]);
    return { accounts, boxes };
  }

  async criar(tenantId: string, id: string, pedido: PedidoDeConta) {
    // Sem data, o saldo inicial é o de hoje: só o que acontecer daqui para frente conta no saldo.
    const openingOn = pedido.openingOn === undefined ? await this.financas.hoje(tenantId) : pedido.openingOn;
    const resultado = await this.contas.criar(tenantId, id, { ...pedido, openingOn });
    if (resultado === "identificador") throw new Conflito("Esse identificador já pertence a outra conta.");
    if (resultado === "nome-ocupado") throw new Conflito("Já existe uma conta com esse nome.");
    return resultado;
  }

  async excluir(tenantId: string, id: string) {
    const resultado = await this.contas.excluir(tenantId, id);
    if (resultado === "ausente") throw new NaoEncontrado("Conta não encontrada.");
    if (resultado === "com-extratos") throw new Conflito("Esta conta tem extratos importados. Apague os extratos antes de excluir a conta.");
    if (resultado === "com-caixinhas") throw new Conflito("Esta conta tem caixinhas. Exclua as caixinhas antes de excluir a conta.");
  }

  /**
   * "O banco mostra R$ X no dia D": a diferença entre isso e o saldo que o sistema calcula vira um lançamento de
   * ajuste na sessão "Ajustes de saldo", ligado à conta. Por padrão ele conta na sobra, porque é dinheiro que entrou
   * ou saiu sem registro; `foraDaSobra` o trata como transferência.
   *
   * Na primeira vez (saldo inicial ainda zero e nenhum ajuste antes), a diferença é o que já estava lá antes dos
   * movimentos lançados: vira o saldo inicial, e nada é lançado, para não entrar como dinheiro novo nas entradas e na
   * sobra do mês.
   */
  async ajustarSaldo(tenantId: string, id: string, pedido: PedidoDeAjusteDeSaldo): Promise<AjusteDeSaldo> {
    const conta = (await this.contas.listar(tenantId)).find((item) => item.id === id);
    if (!conta) throw new NaoEncontrado("Conta não encontrada.");
    const { entries } = await this.financas.listar(tenantId);
    const diferencaCents = pedido.saldoCents - resumoDaConta(conta, entries, pedido.date).saldoCents;
    if (diferencaCents === 0) return { diferencaCents, entry: null };
    if (primeiroSaldoInformado(conta.openingCents, entries, (entry) => entry.accountId === conta.id && entry.sessionName === SESSAO_DOS_AJUSTES)) {
      await this.atualizar(tenantId, id, {
        name: conta.name,
        kind: conta.kind,
        // O saldo inicial passa a ser o que falta para o saldo calculado bater com o informado.
        openingCents: conta.openingCents + diferencaCents,
        openingOn: conta.openingOn,
        closingDay: conta.closingDay,
        dueDay: conta.dueDay,
        limitCents: conta.limitCents,
      });
      return { diferencaCents, entry: null, comoSaldoInicial: true };
    }
    const entry = await this.financas.registrar(tenantId, {
      id: randomUUID(),
      sessionId: await this.sessaoDosAjustes(tenantId),
      name: `Ajuste de saldo · ${conta.name}`.slice(0, 160),
      description: "",
      justification: "O saldo informado era diferente do calculado.",
      date: pedido.date,
      mode: diferencaCents > 0 ? "inflows" : "outflows",
      status: "completed",
      transactionType: "unusual",
      category: "unique",
      priority: "nopriority",
      cents: Math.abs(diferencaCents),
      installments: null,
      installmentNumber: null,
      dueDate: null,
      interestRate: null,
      nextDueDate: null,
      recurrence: null,
      recurrenceInterval: null,
      dueRule: null,
      accountId: conta.id,
      transfer: pedido.foraDaSobra,
    });
    return { diferencaCents, entry };
  }

  /** O patrimônio e o saldo de hoje de cada conta e caixinha: o que a tela de Contas mostra. */
  async saldos(tenantId: string): Promise<SaldosResposta> {
    const [contas, caixinhas, { entries }, hoje] = await Promise.all([
      this.contas.listar(tenantId),
      this.caixinhas.listar(tenantId),
      this.financas.listar(tenantId),
      this.financas.hoje(tenantId),
    ]);
    return {
      hoje,
      patrimonio: patrimonio(contas, caixinhas, entries, hoje),
      contas: contas.map((conta) => ({ id: conta.id, name: conta.name, kind: conta.kind, openingOn: conta.openingOn, ...resumoDaConta(conta, entries, hoje) })),
      caixinhas: caixinhas.map((caixinha) => {
        const resumo = resumoDaCaixinha(caixinha, entries, hoje);
        return { id: caixinha.id, name: caixinha.name, accountId: caixinha.accountId, goalId: caixinha.goalId, saldoCents: resumo.saldoCents, rendimentoDoMesCents: resumo.rendimentoDoMesCents };
      }),
      evolucao: evolucaoDoPatrimonio(contas, caixinhas, entries, hoje, 6),
    };
  }

  /** As últimas faturas do cartão e o limite. */
  async faturas(tenantId: string, id: string): Promise<FaturasResposta> {
    const conta = (await this.contas.listar(tenantId)).find((item) => item.id === id);
    if (!conta) throw new NaoEncontrado("Conta não encontrada.");
    if (conta.kind !== "cartao") throw new Conflito("Só cartão de crédito tem fatura.");
    const { entries } = await this.financas.listar(tenantId);
    const hoje = await this.financas.hoje(tenantId);
    return { faturas: faturasDoCartao(conta, entries, hoje), limite: limiteDoCartao(conta, entries, hoje) };
  }

  /**
   * Paga a fatura: o dinheiro sai da conta e entra no cartão. São dois lançamentos de transferência com o mesmo
   * `pairId`, na sessão "Entre contas" do grupo "Transferências"; nenhum entra na sobra, porque as compras já
   * entraram quando foram feitas.
   */
  async pagarFatura(tenantId: string, id: string, pedido: PedidoDePagamentoDaFatura): Promise<PagamentoDaFatura> {
    const contas = await this.contas.listar(tenantId);
    const cartao = contas.find((item) => item.id === id);
    if (!cartao) throw new NaoEncontrado("Conta não encontrada.");
    if (cartao.kind !== "cartao") throw new Conflito("Só cartão de crédito tem fatura.");
    const origem = contas.find((item) => item.id === pedido.fromAccountId);
    if (!origem) throw new NaoEncontrado("Conta de origem não encontrada.");
    if (origem.kind === "cartao") throw new Conflito("A fatura é paga a partir de uma conta, não de outro cartão.");
    const [ano, mes] = pedido.month.split("-").map(Number) as [number, number];
    const nomeDoMes = `${NOME_DO_MES[mes - 1] ?? pedido.month}/${ano}`;
    return this.criarPar(tenantId, {
      origem,
      destino: cartao,
      cents: pedido.cents,
      date: pedido.date,
      description: `Fatura de ${nomeDoMes}`,
      nomeDaSaida: `Pagamento da fatura · ${cartao.name}`,
      nomeDaEntrada: `Fatura paga · ${cartao.name}`,
    });
  }

  /** Move dinheiro entre duas contas da pessoa: o par de transferências, fora da sobra. */
  async transferir(tenantId: string, pedido: PedidoDeTransferencia): Promise<ParDeTransferencia> {
    const contas = await this.contas.listar(tenantId);
    const origem = contas.find((item) => item.id === pedido.fromAccountId);
    const destino = contas.find((item) => item.id === pedido.toAccountId);
    if (!origem || !destino) throw new NaoEncontrado("Conta não encontrada.");
    if (origem.id === destino.id) throw new Conflito("Escolha duas contas diferentes.");
    return this.criarPar(tenantId, {
      origem,
      destino,
      cents: pedido.cents,
      date: pedido.date,
      description: pedido.note?.trim() ?? "",
      nomeDaSaida: `Transferência para ${destino.name}`,
      nomeDaEntrada: `Transferência de ${origem.name}`,
    });
  }

  /**
   * Os dois lançamentos de uma transferência, com o mesmo `pairId`, na sessão "Entre contas" do grupo
   * "Transferências". Nenhum entra na sobra. Se o segundo falhar, o primeiro é desfeito.
   */
  async criarPar(
    tenantId: string,
    par: { origem: { id: string }; destino: { id: string }; cents: number; date: string; description: string; nomeDaSaida: string; nomeDaEntrada: string },
  ): Promise<ParDeTransferencia> {
    if (par.cents <= 0) throw new Conflito("Informe o valor da transferência.");
    const sessionId = await this.sessaoDasTransferencias(tenantId);
    const pairId = randomUUID();
    const base = {
      sessionId,
      description: par.description.slice(0, 160),
      justification: "",
      date: par.date,
      status: "completed" as const,
      transactionType: "unusual" as const,
      category: "unique" as const,
      priority: "nopriority" as const,
      cents: par.cents,
      installments: null,
      installmentNumber: null,
      dueDate: null,
      interestRate: null,
      nextDueDate: null,
      recurrence: null,
      recurrenceInterval: null,
      dueRule: null,
      transfer: true,
      pairId,
    } satisfies Partial<PedidoLancamento>;
    const saida = await this.financas.registrar(tenantId, { ...base, id: randomUUID(), name: par.nomeDaSaida.slice(0, 160), mode: "outflows", accountId: par.origem.id });
    try {
      const entrada = await this.financas.registrar(tenantId, { ...base, id: randomUUID(), name: par.nomeDaEntrada.slice(0, 160), mode: "inflows", accountId: par.destino.id });
      return { pairId, saida, entrada };
    } catch (error) {
      await this.financas.excluir(tenantId, saida.id).catch(() => undefined);
      throw error;
    }
  }

  // O grupo "Ajustes" e a sessão "Ajustes de saldo" nascem no primeiro ajuste.
  private sessaoDosAjustes(tenantId: string) {
    return this.sessaoFixa(tenantId, GRUPO_DOS_AJUSTES, SESSAO_DOS_AJUSTES, "As diferenças entre o saldo informado e o calculado.", "Ajustes de saldo das contas.");
  }

  // O grupo "Transferências" e a sessão "Entre contas" nascem na primeira transferência.
  private sessaoDasTransferencias(tenantId: string) {
    return this.sessaoFixa(tenantId, GRUPO_DAS_TRANSFERENCIAS, SESSAO_DAS_TRANSFERENCIAS, "Dinheiro que muda de uma conta para outra, fora da sobra.", "Os dois lados de cada transferência.");
  }

  private async sessaoFixa(tenantId: string, grupo: string, sessao: string, descricaoDoGrupo: string, justificativa: string) {
    const { groups, sessions } = await this.grupos.listar(tenantId);
    const existente = groups.find((item) => item.name.toLowerCase() === grupo.toLowerCase());
    const groupId = existente?.id ?? (await this.grupos.criarGrupo(tenantId, randomUUID(), grupo, descricaoDoGrupo)).id;
    const aberta = sessions.find((item) => item.groupId === groupId && item.name.toLowerCase() === sessao.toLowerCase() && !item.endedAt);
    if (aberta) return aberta.id;
    const sessionId = randomUUID();
    await this.grupos.criarSessao(tenantId, sessionId, { groupId, name: sessao, description: "", justification: justificativa }, "acumulo");
    return sessionId;
  }

  async atualizar(tenantId: string, id: string, pedido: PedidoDeConta) {
    const resultado = await this.contas.atualizar(tenantId, id, pedido);
    if (resultado === "ausente") throw new NaoEncontrado("Conta não encontrada.");
    if (resultado === "nome-ocupado") throw new Conflito("Já existe uma conta com esse nome.");
    if (resultado === "com-caixinhas") throw new Conflito("Esta conta tem caixinhas: ela não pode virar cartão de crédito.");
    return resultado;
  }
}
