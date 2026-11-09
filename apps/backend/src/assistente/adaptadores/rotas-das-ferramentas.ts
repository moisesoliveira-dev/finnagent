import { randomUUID } from "node:crypto";
import { diaNoFuso } from "../../financas/dominio/vista.js";

type Args = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Rota = {
  metodo: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  caminho: (args: Args) => string;
  consulta?: (args: Args) => Record<string, string | number | boolean | undefined | null>;
  /** `idGerado`: o id que o passo do plano já deu ao que esta rota cria. */
  corpo?: (args: Args, fuso: string, idGerado?: string) => unknown;
};

const id = (valor: unknown) => encodeURIComponent(String(valor));

/** O formulário de lançamento da tela, com os padrões que a tela também usa. */
function lancamento(args: Args, identificador: string) {
  return {
    id: identificador,
    sessionId: args.sessionId,
    accountId: args.accountId ?? null,
    transfer: args.transfer ?? false,
    name: args.name,
    description: args.description ?? "",
    justification: args.justification?.trim() ?? "",
    date: args.date,
    mode: args.mode,
    status: args.status ?? "pending",
    // A regra da categoria corrige o tipo e a prioridade no backend, como faz para a tela.
    transactionType: "unusual",
    category: args.category,
    priority: args.priority ?? "nopriority",
    cents: args.cents,
    installments: args.installments ?? null,
    installmentNumber: args.installmentNumber ?? null,
    dueDate: args.dueDate ?? null,
    interestRate: args.interestRate ?? null,
    nextDueDate: args.nextDueDate ?? null,
    recurrence: args.recurrence ?? null,
    recurrenceInterval: args.recurrenceInterval ?? null,
    // Sem regra, o backend aplica o padrão da categoria nas configurações.
    dueRule: args.dueRule
      ? { ordem: null, contagem: "bancaria", ...args.dueRule }
      : null,
  };
}

function compromisso(args: Args, fuso: string) {
  const diaInteiro = args.allDay ?? !args.time;
  return {
    title: args.title,
    description: args.description ?? "",
    location: args.location ?? "",
    allDay: diaInteiro,
    year: args.year,
    month: args.month,
    day: args.day,
    time: diaInteiro ? null : (args.time ?? null),
    endTime: diaInteiro ? null : (args.endTime ?? null),
    calendar: args.calendar,
    timezone: fuso,
    category: args.category,
    endYear: args.endYear ?? null,
    endMonth: args.endMonth ?? null,
    endDay: args.endDay ?? null,
    entryId: args.entryId ?? null,
    sessionId: args.sessionId ?? null,
    askSpending: args.askSpending ?? true,
  };
}

/**
 * A ferramenta e a rota da API que ela usa. Só o que está aqui é executado: perfil, senha, sessões de acesso,
 * usuários, provedores de IA, a conexão com o Google e exportar, importar e zerar dados não têm entrada, então a
 * IA não alcança essas telas. Das configurações, só os padrões de vencimento.
 */
export const ROTAS_DAS_FERRAMENTAS: Record<string, Rota> = {
  listar_grupos_e_sessoes: { metodo: "GET", caminho: () => "grupos" },
  consultar_hoje: { metodo: "GET", caminho: () => "hoje", consulta: (a) => ({ date: a.date }) },
  criar_tarefa: {
    metodo: "POST",
    caminho: () => "tarefas",
    corpo: (a, fuso, idGerado) => ({ id: idGerado ?? randomUUID(), title: a.title, date: a.date ?? diaNoFuso(fuso), ...(a.parentId ? { parentId: a.parentId } : {}), ...(a.repeat && !a.parentId ? { repeat: a.repeat } : {}) }),
  },
  editar_tarefa: {
    metodo: "PATCH",
    caminho: (a) => `tarefas/${id(a.id)}`,
    corpo: (a) => ({ title: a.title, date: a.date, parentId: a.parentId ?? null, repeat: a.parentId ? null : (a.repeat ?? null) }),
  },
  concluir_tarefa: { metodo: "PATCH", caminho: (a) => `tarefas/${id(a.id)}/concluir`, corpo: (a) => ({ done: a.done }) },
  mover_tarefa: { metodo: "PATCH", caminho: (a) => `tarefas/${id(a.id)}/mover`, corpo: (a) => ({ parentId: a.parentId ?? null, beforeId: a.beforeId ?? null }) },
  excluir_tarefa: { metodo: "DELETE", caminho: (a) => `tarefas/${id(a.id)}` },
  consultar_lancamentos: {
    metodo: "GET",
    caminho: () => "financas/base",
    consulta: (a) => ({ year: a.year, month: a.month, day: a.day, groupId: a.groupId, category: a.category, q: a.q }),
  },
  // O painel do mês pedido, e não a visão de Finanças: nela o mês do workflow (o de início) parecia o mês atual.
  consultar_mes_financeiro: {
    metodo: "GET",
    caminho: () => "painel",
    consulta: (a) => ({ scope: "mes", year: a.year, month: a.month }),
  },
  criar_lancamento: {
    metodo: "POST",
    caminho: () => "lancamentos",
    corpo: (a, _fuso, idGerado) => lancamento(a, idGerado ?? randomUUID()),
  },
  editar_lancamento: { metodo: "PATCH", caminho: (a) => `lancamentos/${id(a.id)}`, corpo: (a) => lancamento(a, a.id) },
  alterar_status_lancamento: {
    metodo: "PATCH",
    caminho: (a) => `lancamentos/${id(a.id)}/status`,
    corpo: (a) => ({ status: a.status }),
  },
  atualizar_ocorrencia: {
    metodo: "PATCH",
    caminho: (a) => `lancamentos/${id(a.id)}/ocorrencias/${id(a.number)}`,
    corpo: (a) => ({ status: a.status, dueDate: a.dueDate, plannedCents: a.plannedCents }),
  },
  excluir_ocorrencia: { metodo: "DELETE", caminho: (a) => `lancamentos/${id(a.id)}/ocorrencias/${id(a.number)}` },
  excluir_lancamento: { metodo: "DELETE", caminho: (a) => `lancamentos/${id(a.id)}` },
  registrar_pagamento: {
    metodo: "POST",
    caminho: (a) => `lancamentos/${id(a.id)}/pagamentos`,
    corpo: (a) => ({ date: a.date, cents: a.cents, ...(a.diferenca ? { diferenca: a.diferenca } : {}) }),
  },
  desfazer_pagamento: { metodo: "DELETE", caminho: (a) => `lancamentos/${id(a.id)}/pagamentos/${id(a.paymentId)}` },
  adiantar_parcelas: { metodo: "POST", caminho: (a) => `lancamentos/${id(a.id)}/parcelas/adiantar` },
  cancelar_parcelas: { metodo: "POST", caminho: (a) => `lancamentos/${id(a.id)}/parcelas/cancelar` },
  adiantar_emprestimo: { metodo: "POST", caminho: (a) => `lancamentos/${id(a.id)}/emprestimo/adiantar` },
  cancelar_emprestimo: { metodo: "POST", caminho: (a) => `lancamentos/${id(a.id)}/emprestimo/cancelar` },
  cancelar_fixo_no_mes: {
    metodo: "POST",
    caminho: (a) => `lancamentos/${id(a.id)}/fixo/cancelar`,
    corpo: (a) => ({ year: a.year, month: a.month }),
  },
  suspender_fixo_no_mes: {
    metodo: "POST",
    caminho: (a) => `lancamentos/${id(a.id)}/fixo/suspender`,
    corpo: (a) => ({ year: a.year, month: a.month }),
  },
  atualizar_valor_dos_fixos: { metodo: "POST", caminho: () => "lancamentos/fixos/valor", corpo: (a) => ({ updates: a.updates }) },
  associar_compromisso: {
    metodo: "POST",
    caminho: (a) => `lancamentos/${id(a.id)}/compromisso`,
    corpo: (a) => ({ commitmentId: a.commitmentId }),
  },
  criar_grupo: {
    metodo: "POST",
    caminho: () => "grupos",
    corpo: (a, _fuso, idGerado) => ({ id: idGerado ?? randomUUID(), name: a.name, description: a.description ?? "" }),
  },
  editar_grupo: {
    metodo: "PATCH",
    caminho: (a) => `grupos/${id(a.id)}`,
    corpo: (a) => ({ name: a.name, description: a.description }),
  },
  excluir_grupo: { metodo: "DELETE", caminho: (a) => `grupos/${id(a.id)}` },
  criar_sessao: {
    metodo: "POST",
    caminho: () => "sessoes",
    corpo: (a, _fuso, idGerado) => ({
      id: idGerado ?? randomUUID(),
      groupId: a.groupId,
      name: a.name,
      description: a.description ?? "",
      justification: a.justification ?? "",
      kind: a.kind,
      limitCents: a.limitCents ?? null,
    }),
  },
  editar_sessao: {
    metodo: "PATCH",
    caminho: (a) => `sessoes/${id(a.id)}`,
    corpo: (a) => ({ name: a.name, description: a.description, justification: a.justification, groupId: a.groupId, ...(a.limitCents === undefined ? {} : { limitCents: a.limitCents }) }),
  },
  excluir_sessao: { metodo: "DELETE", caminho: (a) => `sessoes/${id(a.id)}` },
  consultar_virada_do_ano: { metodo: "GET", caminho: () => "grupos/virada" },
  confirmar_virada_do_ano: {
    metodo: "POST",
    caminho: () => "grupos/virada",
    corpo: (a) => ({ year: a.year, groupIds: a.groupIds, sessionIds: a.sessionIds }),
  },
  consultar_agenda: { metodo: "GET", caminho: () => "agenda", consulta: (a) => ({ year: a.year, month: a.month }) },
  criar_compromisso: {
    metodo: "POST",
    caminho: () => "compromissos",
    corpo: (a, fuso, idGerado) => ({ id: idGerado ?? randomUUID(), ...compromisso(a, fuso) }),
  },
  editar_compromisso: { metodo: "PATCH", caminho: (a) => `compromissos/${id(a.id)}`, corpo: (a, fuso) => compromisso(a, fuso) },
  mover_compromisso: {
    metodo: "POST",
    caminho: (a) => `compromissos/${id(a.id)}/mover`,
    corpo: (a) => ({ year: a.year, month: a.month, day: a.day }),
  },
  alterar_status_compromisso: {
    metodo: "PATCH",
    caminho: (a) => `compromissos/${id(a.id)}/status`,
    corpo: (a) => ({ status: a.status }),
  },
  excluir_compromisso: { metodo: "DELETE", caminho: (a) => `compromissos/${id(a.id)}` },
  registrar_gasto_do_compromisso: {
    metodo: "POST",
    caminho: (a) => `compromissos/${id(a.id)}/gastos`,
    corpo: (a, _fuso, idGerado) => ({ id: idGerado ?? randomUUID(), date: a.date, cents: a.cents, ...(a.sessionId ? { sessionId: a.sessionId } : {}) }),
  },
  sem_gasto_no_compromisso: { metodo: "POST", caminho: (a) => `compromissos/${id(a.id)}/sem-gasto`, corpo: (a) => ({ date: a.date }) },
  sincronizar_google_calendar: { metodo: "POST", caminho: () => "agenda/sincronizar" },
  consultar_metas: { metodo: "GET", caminho: () => "metas" },
  dividir_sobra_das_metas: {
    metodo: "PUT",
    caminho: () => "metas/divisao",
    corpo: (a) => ({
      percents: Object.fromEntries(((a.percents as Array<{ id: string; percent: number }>) ?? []).map((item) => [item.id, item.percent])),
    }),
  },
  organizar_prioridade_das_metas: { metodo: "PUT", caminho: () => "metas/ordem", corpo: (a) => ({ ids: a.ids }) },
  aprovar_parte_da_meta: { metodo: "POST", caminho: (a) => `metas/${id(a.id)}/aprovar` },
  separar_valor_da_meta: { metodo: "POST", caminho: (a) => `metas/${id(a.id)}/separar`, corpo: (a) => ({ cents: a.cents }) },
  criar_meta: {
    metodo: "POST",
    caminho: () => "metas",
    corpo: (a, _fuso, idGerado) => ({
      id: idGerado ?? randomUUID(),
      name: a.name,
      targetCents: a.targetCents,
      savedCents: a.savedCents ?? 0,
      dueYear: a.dueYear ?? null,
      dueMonth: a.dueMonth ?? null,
    }),
  },
  excluir_meta: { metodo: "DELETE", caminho: (a) => `metas/${id(a.id)}` },
  consultar_extratos: { metodo: "GET", caminho: () => "extratos" },
  consultar_linhas_do_extrato: {
    metodo: "GET",
    caminho: (a) => `extratos/${id(a.id)}/linhas`,
    consulta: (a) => ({ erros: a.somenteErros ? "1" : undefined }),
  },
  consultar_conferencia: {
    metodo: "GET",
    caminho: () => "extratos/conferencia",
    // pagina 0: todas as linhas sem lançamento de uma vez.
    consulta: (a) => ({ year: a.year, month: a.month, pagina: a.todas ? 0 : (a.pagina ?? 1), ...(a.busca ? { busca: a.busca } : {}) }),
  },
  ignorar_linhas: { metodo: "POST", caminho: () => "extratos/ignorar", corpo: (a) => ({ items: a.items, ignored: a.ignored }) },
  dividir_linha: {
    metodo: "POST",
    caminho: () => "extratos/dividir",
    corpo: (a) => ({ statementId: a.statementId, line: a.line, parts: a.parts }),
  },
  desfazer_conferencia: { metodo: "POST", caminho: () => "extratos/conferencia/desfazer-tudo" },
  cruzar_linha: {
    metodo: "POST",
    caminho: () => "extratos/cruzamentos",
    corpo: (a) => ({ statementId: a.statementId, line: a.line, entryId: a.entryId, valor: a.valor, ...(a.diferenca ? { diferenca: a.diferenca } : {}) }),
  },
  desfazer_cruzamento: {
    metodo: "POST",
    caminho: () => "extratos/cruzamentos/desfazer",
    corpo: (a) => ({ statementId: a.statementId, line: a.line }),
  },
  acumular_linha: {
    metodo: "POST",
    caminho: () => "extratos/acumular",
    corpo: (a) => ({ statementId: a.statementId, line: a.line, sessionId: a.sessionId, ...(a.tipo ? { tipo: a.tipo } : {}) }),
  },
  acumular_linhas: { metodo: "POST", caminho: () => "extratos/acumular-lote", corpo: (a) => ({ items: a.items }) },
  importar_extrato: {
    metodo: "POST",
    caminho: () => "extratos/de-anexo",
    corpo: (a, _fuso, idGerado) => ({
      id: idGerado ?? randomUUID(),
      anexoId: a.anexoId,
      accountName: a.accountName,
      observacao: a.observacao ?? "",
      mapping: a.colunas ?? null,
    }),
  },
  reprocessar_extrato: { metodo: "POST", caminho: (a) => `extratos/${id(a.id)}/reprocessar` },
  excluir_extrato: { metodo: "DELETE", caminho: (a) => `extratos/${id(a.id)}` },
  consultar_contas: { metodo: "GET", caminho: () => "contas" },
  criar_conta: {
    metodo: "POST",
    caminho: () => "contas",
    corpo: (a, _fuso, idGerado) => ({ id: idGerado ?? randomUUID(), name: a.name, kind: a.kind, openingCents: a.openingCents ?? 0 }),
  },
  editar_conta: {
    metodo: "PATCH",
    caminho: (a) => `contas/${id(a.id)}`,
    corpo: (a) => ({ name: a.name, kind: a.kind, openingCents: a.openingCents }),
  },
  excluir_conta: { metodo: "DELETE", caminho: (a) => `contas/${id(a.id)}` },
  consultar_feriados: { metodo: "GET", caminho: () => "feriados", consulta: (a) => ({ year: a.year }) },
  criar_feriado_local: { metodo: "POST", caminho: () => "feriados", corpo: (a) => ({ nome: a.nome, dia: a.dia, mes: a.mes }) },
  excluir_feriado_local: { metodo: "DELETE", caminho: (a) => `feriados/${id(a.id)}` },
  consultar_padroes_de_vencimento: { metodo: "GET", caminho: () => "configuracoes/vencimentos" },
  atualizar_padroes_de_vencimento: {
    metodo: "PATCH",
    caminho: () => "configuracoes/vencimentos",
    corpo: (a) => ({ fixa_entrada: a.fixa_entrada, fixa_saida: a.fixa_saida, parcela: a.parcela, emprestimo: a.emprestimo }),
  },
  consultar_notificacoes: { metodo: "GET", caminho: () => "notificacoes" },
  marcar_notificacao_lida: { metodo: "POST", caminho: (a) => `notificacoes/${id(a.id)}/lida` },
  marcar_notificacoes_lidas: { metodo: "POST", caminho: () => "notificacoes/lidas" },
  consultar_painel: {
    metodo: "GET",
    caminho: () => "painel",
    consulta: (a) => ({ scope: a.scope, year: a.year, month: a.month, day: a.day }),
  },
  consultar_relatorio: { metodo: "GET", caminho: () => "relatorios", consulta: (a) => ({ year: a.year }) },
  consultar_visao_do_ano: { metodo: "GET", caminho: () => "financas/geral", consulta: (a) => ({ year: a.year }) },
  consultar_eventos: { metodo: "GET", caminho: () => "eventos" },
};

export function montarUrl(base: string, rota: Rota, args: Args) {
  const url = new URL(rota.caminho(args), base.endsWith("/") ? base : `${base}/`);
  for (const [chave, valor] of Object.entries(rota.consulta?.(args) ?? {})) {
    if (valor !== undefined && valor !== null && valor !== "") url.searchParams.set(chave, String(valor));
  }
  return url;
}
