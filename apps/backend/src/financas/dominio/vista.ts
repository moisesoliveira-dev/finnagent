import {
  CATEGORIAS_TRANSACAO,
  STATUS_TRANSACAO,
  categoriaDeCompromisso,
  categoriaSempreEntrada,
  categoriaSempreSaida,
  centavosComSinal,
  centavosNoMes,
  colunasDoAno,
  encerraNoMes,
  ocorrenciasDoLancamento,
  proximoVencimento,
  situacaoDaOcorrencia,
  situacaoDoLancamento,
  somaDosCentavos,
  termosTravados,
  textoDaLinha,
  totaisDoMes,
  transicaoDaOcorrencia,
  type BaseResposta,
  type CategoriaTransacao,
  type FinancasResposta,
  type FinancasVista,
  type GeralResposta,
  type GrupoGeral,
  type Lancamento,
  type LancamentoVista,
  type LinhaBase,
  type Ocorrencia,
  type OcorrenciaVista,
  type RegraCategoria,
  type SituacaoOcorrencia,
  type Workflow,
} from "@finnagent/contracts";

export function diaNoFuso(fuso: string, agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const parte = (tipo: string) => partes.find((item) => item.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export function regraDaCategoria(category: CategoriaTransacao): RegraCategoria {
  const parcelada = category === "installment" || category === "loan";
  return {
    mode: categoriaSempreEntrada(category)
      ? "inflows"
      : categoriaSempreSaida(category)
        ? "outflows"
        : null,
    transactionType: categoriaDeCompromisso(category) ? "appointment" : null,
    priority:
      category === "installment" ? "sempre" : categoriaSempreEntrada(category) ? "nunca" : "saida",
    installments: parcelada,
    loan: category === "loan",
    recurrence: category === "fixed",
  };
}

export function regrasDasCategorias() {
  return Object.fromEntries(
    CATEGORIAS_TRANSACAO.map((category) => [category, regraDaCategoria(category)]),
  ) as Record<CategoriaTransacao, RegraCategoria>;
}

export function valorDaOcorrencia(item: Ocorrencia) {
  if (item.status === "completed" && item.paidCents != null) return item.paidCents;
  return item.plannedCents;
}

export function centavosDoContrato(entry: Lancamento) {
  if (entry.cents !== 0) return entry.cents;
  const doMes = entry.months.find(
    (mes) => mes.year === entry.startYear && mes.month === entry.startMonth,
  );
  return doMes?.cents ?? entry.cents;
}

export function ocorrenciaVista(item: Ocorrencia, synced: boolean, hoje: string): OcorrenciaVista {
  return {
    ...item,
    situation: situacaoDaOcorrencia(item, hoje),
    cents: valorDaOcorrencia(item),
    next: STATUS_TRANSACAO.filter(
      (status) => status !== item.status && transicaoDaOcorrencia(item, status) !== "bloqueada",
    ),
    editable: item.status === "pending" && !synced,
  };
}

export function lancamentoVista(entry: Lancamento, hoje: string): LancamentoVista {
  const lista = ocorrenciasDoLancamento(entry);
  const suspensos = entry.adjustments.filter((ajuste) => ajuste.effect === "suspended").length;
  return {
    ...entry,
    occurrences: lista.map((item) => ocorrenciaVista(item, entry.synced, hoje)),
    situation: situacaoDoLancamento(entry, hoje),
    termsLocked: termosTravados(lista, entry.synced),
    nextDue: proximoVencimento(lista),
    contractCents: centavosDoContrato(entry),
    suspendedTotal: centavosComSinal(Math.abs(entry.cents) * suspensos, entry.mode),
    actions: {
      remove: !entry.synced,
      series: entry.category === "installment" || entry.category === "loan" ? entry.category : null,
      fixedMonth: entry.category === "fixed",
    },
  };
}

export function montarVista(base: FinancasResposta, hoje: string): FinancasVista {
  return {
    workflow: base.workflow,
    entries: base.entries.map((entry) => lancamentoVista(entry, hoje)),
    rules: regrasDasCategorias(),
  };
}

export function situacaoNoMes(
  entry: Lancamento,
  year: number,
  month: number,
  hoje: string,
): SituacaoOcorrencia {
  const prefixo = `${year}-${String(month).padStart(2, "0")}-`;
  const situacoes = ocorrenciasDoLancamento(entry)
    .filter((item) => item.dueDate.startsWith(prefixo))
    .filter((item) => item.status === "pending" || item.status === "completed")
    .map((item) => situacaoDaOcorrencia(item, hoje));
  if (situacoes.includes("late")) return "late";
  if (situacoes.includes("pending")) return "pending";
  if (situacoes.includes("completed")) return "completed";
  return entry.status;
}

export type FiltroBase = {
  year: number | null;
  month: number | null;
  day: number | null;
  groupId: string | null;
  category: CategoriaTransacao | null;
  q: string;
};

export function montarBase(base: FinancasResposta, hoje: string, filtro: FiltroBase): BaseResposta {
  const { workflow, entries } = base;
  const pedido = filtro.year != null && filtro.year >= workflow.year ? filtro.year : workflow.year;
  const years = anosDaBase(workflow, entries, pedido, hoje);
  const year = years.includes(pedido) ? pedido : workflow.year;
  const months = colunasDoAno(workflow, year).map((indice) => indice + 1);
  const month = filtro.month != null && months.includes(filtro.month) ? filtro.month : null;
  const days = month == null ? [] : diasDoMes(workflow, year, month);
  const day = filtro.day != null && days.includes(filtro.day) ? filtro.day : null;
  const busca = filtro.q.trim().toLowerCase();
  const rows: LinhaBase[] = [];
  let totalCents = 0;
  for (const entry of entries) {
    if (filtro.groupId && entry.groupId !== filtro.groupId) continue;
    if (filtro.category && entry.category !== filtro.category) continue;
    const texto = `${entry.name} ${entry.description} ${entry.justification} ${entry.sessionName}`;
    if (busca && !texto.toLowerCase().includes(busca)) continue;
    const lista = ocorrenciasDoLancamento(entry);
    for (const item of lista) {
      const [ano, mes, dia] = item.dueDate.split("-").map(Number);
      if (ano !== year || !mes || !dia || !months.includes(mes)) continue;
      if (month != null && mes !== month) continue;
      if (day != null && dia !== day) continue;
      if (ano === workflow.year && mes === workflow.month && dia < workflow.day) continue;
      const cents = valorDaOcorrencia(item);
      if (item.status === "pending" || item.status === "completed") totalCents += cents;
      rows.push({
        entryId: entry.id,
        number: item.number,
        dueDate: item.dueDate,
        name: entry.name,
        description: entry.description,
        justification: entry.justification,
        groupName: entry.groupName,
        sessionName: entry.sessionName,
        category: entry.category,
        priority: entry.priority,
        situation: situacaoDaOcorrencia(item, hoje),
        cents,
        installment:
          entry.type === "parcela" || entry.type === "empréstimo"
            ? { number: item.number, total: entry.installments ?? lista.length }
            : null,
        remove: removerDaLinha(entry, lista, item),
        synced: entry.synced,
      });
    }
  }
  rows.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      (a.name || a.description).localeCompare(b.name || b.description, "pt"),
  );
  return {
    year,
    month,
    day,
    years,
    months,
    days,
    groups: gruposDe(entries),
    rows,
    totalCents,
  };
}

export function montarGeral(base: FinancasResposta, year: number): GeralResposta {
  const { workflow, entries } = base;
  const colunas = colunasDoAno(workflow, year);
  const grupos: GrupoGeral[] = [];
  for (const entry of entries) {
    const valores = colunas.map((indice) => centavosNoMes(entry, workflow, year, indice));
    if (valores.every((valor) => valor === undefined)) continue;
    let grupo = grupos.find((item) => item.id === entry.groupId);
    if (!grupo) {
      grupo = {
        id: entry.groupId,
        name: entry.groupName,
        cents: colunas.map(() => 0),
        totalCents: 0,
        entries: [],
      };
      grupos.push(grupo);
    }
    const fim = colunas.find(
      (indice, posicao) => valores[posicao] !== undefined && encerraNoMes(entry, year, indice),
    );
    const cents = valores.map((valor) => valor ?? null);
    const total = somaDosCentavos(valores);
    const linha = grupo.entries.find((item) => item.id === entry.sessionId);
    if (!linha) {
      grupo.entries.push({
        id: entry.sessionId,
        sessionName: entry.sessionName,
        summary: textoDaLinha(entry),
        cents,
        endsIn: fim === undefined ? null : fim + 1,
        totalCents: total,
      });
    } else {
      linha.cents = linha.cents.map((atual, posicao) => {
        const novo = cents[posicao];
        if (atual == null) return novo ?? null;
        if (novo == null) return atual;
        return atual + novo;
      });
      linha.totalCents += total;
      linha.summary = "Soma das transações";
      linha.endsIn = null;
    }
    valores.forEach((valor, posicao) => {
      if (grupo) grupo.cents[posicao] = (grupo.cents[posicao] ?? 0) + (valor ?? 0);
    });
    grupo.totalCents += somaDosCentavos(valores);
  }
  const porMes = colunas.map((indice) => totaisDoMes(entries, workflow, year, indice));
  const inflows = porMes.map((mes) => mes.entradas);
  const outflows = porMes.map((mes) => mes.saidas);
  const surplus = porMes.map((mes) => mes.sobra);
  return {
    year,
    months: colunas.map((indice) => indice + 1),
    groups: grupos,
    totals: {
      inflows,
      outflows,
      surplus,
      inflowsCents: somaDosCentavos(inflows),
      outflowsCents: somaDosCentavos(outflows),
      surplusCents: somaDosCentavos(surplus),
    },
  };
}

export function removerDaLinha(entry: Lancamento, lista: Ocorrencia[], item: Ocorrencia) {
  if (entry.synced) return null;
  if (lista.length <= 1) return "entry" as const;
  return item.status === "pending" ? ("occurrence" as const) : null;
}

function anosDaBase(workflow: Workflow, entries: Lancamento[], pedido: number, hoje: string) {
  let fim = Math.max(workflow.year, pedido, Number(hoje.slice(0, 4)));
  for (const entry of entries) {
    for (const item of ocorrenciasDoLancamento(entry)) {
      fim = Math.max(fim, Number(item.dueDate.slice(0, 4)));
    }
  }
  return Array.from({ length: fim - workflow.year + 1 }, (_, indice) => workflow.year + indice);
}

function diasDoMes(workflow: Workflow, year: number, month: number) {
  const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const inicio = year === workflow.year && month === workflow.month ? workflow.day : 1;
  return Array.from({ length: Math.max(ultimo - inicio + 1, 0) }, (_, indice) => inicio + indice);
}

function gruposDe(entries: Lancamento[]) {
  const grupos: { id: string; name: string }[] = [];
  for (const entry of entries) {
    if (!grupos.some((grupo) => grupo.id === entry.groupId)) {
      grupos.push({ id: entry.groupId, name: entry.groupName });
    }
  }
  return grupos;
}
