import {
  aceitaRegraDeVencimento,
  ajustarTransacao,
  normalizarRegra,
  ocorrenciasDoLancamento,
  proximosVencimentos,
  regraPadrao,
  type CalendarioDeDiasUteis,
  type CategoriaTransacao,
  type FatoDoPasso,
  type FatosDoPlano,
  type Lancamento,
  type ModoTransacao,
  type PadroesDeVencimento,
  type Recorrencia,
  type RegraDeVencimento,
} from "@finnagent/contracts";
import { valorDaOcorrencia } from "../../financas/dominio/vista.js";
import type { PassoValidado } from "./plano.js";

/** O que o sistema já sabe da conta, para medir o plano contra a realidade. */
export type BaseDaRealidade = {
  entries: Lancamento[];
  /** Hoje no fuso da conta (AAAA-MM-DD). */
  hoje: string;
  padroes: PadroesDeVencimento;
  calendario: CalendarioDeDiasUteis;
};

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export type CruzamentoMedido = {
  passo: number;
  data: string;
  escolhido: number;
  /** Centavos já contados na ocorrência. `null` quando a linha cria uma única nova. */
  planejado: number | null;
  entryId: string | null;
  nome: string;
  nota: string;
};

type Item = {
  entryId: string;
  numero: number;
  data: string;
  centavos: number;
  fixa: boolean;
  nome: string;
  pendente: boolean;
};

type Efeito = { itens: Item[]; fato: FatoDoPasso | null; acrescentados: Item[] };

/**
 * Mede o plano antes da aprovação, pela mesma conta que o sistema usa para gravar: as próximas datas de cada
 * lançamento (fim de semana, feriado da conta e regra de vencimento), a sobra do mês antes e depois, e os
 * alertas de consultor. Criar, editar, cancelar e apagar lançamento entram na sobra. O modelo não entra aqui.
 */
export function fatosDoPlano(
  passos: PassoValidado[],
  base: BaseDaRealidade,
  cruzamentos: CruzamentoMedido[] = [],
): FatosDoPlano {
  const chave = mesDoPlano(passos, base, cruzamentos);
  if (!chave) return { mes: null, passos: [], alertas: [] };
  const [ano, mes] = chave.split("-").map(Number) as [number, number];
  let itens = itensNoMes(base.entries, chave);
  const sobraAntes = soma(itens);
  const fatos: FatoDoPasso[] = [];
  const acrescentados: Item[] = [];
  for (const [indice, passo] of passos.entries()) {
    const efeito = aplicarPasso(itens, passo, indice + 1, base, chave);
    itens = efeito.itens;
    if (efeito.fato) fatos.push(efeito.fato);
    acrescentados.push(...efeito.acrescentados);
  }
  for (const cruzamento of cruzamentos) itens = aplicarCruzamento(itens, cruzamento, chave);
  for (const [passo, lista] of agrupar(cruzamentos)) {
    const noMes = lista.filter((item) => item.data.startsWith(chave));
    if (!noMes.length) continue;
    const notas = [...new Set(noMes.map((item) => item.nota).filter(Boolean))];
    fatos.push({
      passo,
      valorCents: noMes.reduce((total, item) => total + item.escolhido, 0),
      recorrente: false,
      datas: noMes.slice(0, 8).map((item) => ({ data: item.data, base: item.data, feriado: null })),
      ...(notas.length ? { nota: notas.join(" ") } : {}),
    });
  }
  const sobraDepois = soma(itens);
  const alertas: string[] = [];
  const nomeDoMes = MESES[mes - 1] ?? chave;
  if (sobraDepois < 0) alertas.push(`A sobra de ${nomeDoMes} fica em ${reais.format(sobraDepois / 100)}.`);
  const entradas = itens.filter((item) => item.centavos > 0);
  const primeiraEntrada = entradas.map((item) => item.data).sort()[0];
  if (primeiraEntrada) {
    for (const conta of acrescentados.filter((item) => item.centavos < 0 && item.data < primeiraEntrada)) {
      alertas.push(
        `${conta.nome} vence dia ${dia(conta.data)}, antes da primeira entrada de ${nomeDoMes} (dia ${dia(primeiraEntrada)}).`,
      );
    }
  }
  const renda = entradas.reduce((total, item) => total + item.centavos, 0);
  const fixas = -itens.filter((item) => item.centavos < 0 && item.fixa).reduce((total, item) => total + item.centavos, 0);
  if (renda > 0 && fixas > renda / 2) {
    alertas.push(`As contas fixas somam ${Math.round((fixas / renda) * 100)}% das entradas de ${nomeDoMes}.`);
  }
  return { mes: { ano, mes, sobraAntesCents: sobraAntes, sobraDepoisCents: sobraDepois }, passos: fatos, alertas };
}

function mesDoPlano(passos: PassoValidado[], base: BaseDaRealidade, cruzamentos: CruzamentoMedido[]) {
  const hoje = base.hoje.slice(0, 7);
  const chaves = new Set<string>();
  for (const passo of passos) {
    for (const data of datasDoPasso(passo, base)) {
      const chave = data.slice(0, 7);
      if (chave >= hoje) chaves.add(chave);
    }
  }
  for (const cruzamento of cruzamentos) {
    const chave = cruzamento.data.slice(0, 7);
    if (chave >= hoje) chaves.add(chave);
  }
  return [...chaves].sort()[0] ?? null;
}

function aplicarCruzamento(itens: Item[], cruzamento: CruzamentoMedido, chave: string) {
  if (!cruzamento.data.startsWith(chave)) return itens;
  if (!cruzamento.entryId || cruzamento.planejado === null) {
    return [...itens, itemDo("extrato", cruzamento.data, cruzamento.escolhido, false, cruzamento.nome)];
  }
  let trocou = false;
  const proximos = itens.map((item) => {
    if (trocou || item.entryId !== cruzamento.entryId || !item.data.startsWith(chave)) return item;
    const outroComOValor = itens.some(
      (outro) => outro !== item && outro.entryId === cruzamento.entryId && outro.centavos === cruzamento.planejado,
    );
    if (item.centavos !== cruzamento.planejado && outroComOValor) return item;
    trocou = true;
    return { ...item, centavos: cruzamento.escolhido };
  });
  return trocou ? proximos : [...itens, itemDo(cruzamento.entryId, cruzamento.data, cruzamento.escolhido, false, cruzamento.nome)];
}

function agrupar(cruzamentos: CruzamentoMedido[]) {
  const grupos = new Map<number, CruzamentoMedido[]>();
  for (const cruzamento of cruzamentos) {
    const lista = grupos.get(cruzamento.passo) ?? [];
    lista.push(cruzamento);
    grupos.set(cruzamento.passo, lista);
  }
  return grupos;
}

function datasDoPasso(passo: PassoValidado, base: BaseDaRealidade) {
  if (passo.ferramenta === "criar_lancamento" || passo.ferramenta === "editar_lancamento") {
    const novo = lancamentoDoPasso(passo.args, base)?.previa.map((item) => item.data) ?? [];
    return passo.ferramenta === "editar_lancamento" ? [...datasDaEntrada(base, passo.args.id), ...novo] : novo;
  }
  if (passo.ferramenta === "cancelar_fixo_no_mes") {
    const year = numero(passo.args.year);
    const month = numero(passo.args.month);
    return year && month ? [`${year}-${String(month).padStart(2, "0")}-01`] : [];
  }
  if (passo.ferramenta === "atualizar_valor_dos_fixos") {
    const updates = Array.isArray(passo.args.updates) ? passo.args.updates : [];
    return updates.flatMap((item) => datasDaEntrada(base, registro(item)?.id));
  }
  if (passo.ferramenta === "atualizar_ocorrencia" || passo.ferramenta === "excluir_ocorrencia") {
    const datas = datasDaOcorrencia(base, passo.args.id, passo.args.number);
    return typeof passo.args.dueDate === "string" ? [...datas, passo.args.dueDate] : datas;
  }
  return datasDaEntrada(base, passo.args.id);
}

function aplicarPasso(itens: Item[], passo: PassoValidado, numeroPasso: number, base: BaseDaRealidade, chave: string): Efeito {
  const igual = { itens, fato: null, acrescentados: [] };
  if (passo.ferramenta === "criar_lancamento" || passo.ferramenta === "editar_lancamento") {
    const lancado = lancamentoDoPasso(passo.args, base);
    if (!lancado) return igual;
    const entryId = passo.ferramenta === "editar_lancamento" && typeof passo.args.id === "string" ? passo.args.id : passo.idGerado;
    const novos = lancado.previa
      .filter((item) => item.data.startsWith(chave))
      .map((item) => itemDo(entryId, item.data, lancado.centavos, lancado.fixa, lancado.nome));
    const semAntigos = passo.ferramenta === "editar_lancamento" ? itens.filter((item) => item.entryId !== entryId) : itens;
    return {
      itens: [...semAntigos, ...novos],
      fato: { passo: numeroPasso, valorCents: lancado.centavos, recorrente: lancado.fixa, datas: lancado.previa },
      acrescentados: passo.ferramenta === "criar_lancamento" ? novos : [],
    };
  }
  const id = typeof passo.args.id === "string" ? passo.args.id : "";
  if (!id) return igual;
  if (passo.ferramenta === "excluir_lancamento" || (passo.ferramenta === "cancelar_fixo_no_mes" && noMesDoPasso(passo, chave))) {
    return tirar(itens, (item) => item.entryId === id, numeroPasso);
  }
  if (passo.ferramenta === "excluir_ocorrencia") {
    const number = numero(passo.args.number);
    return tirar(itens, (item) => item.entryId === id && item.numero === number, numeroPasso);
  }
  if (passo.ferramenta === "cancelar_parcelas" || passo.ferramenta === "cancelar_emprestimo") {
    return tirar(itens, (item) => item.entryId === id && item.pendente && item.data >= base.hoje, numeroPasso);
  }
  if (passo.ferramenta === "alterar_status_lancamento") {
    if (passo.args.status === "cancelled") return tirar(itens, (item) => item.entryId === id && item.pendente, numeroPasso);
    if (passo.args.status === "refunded") return tirar(itens, (item) => item.entryId === id && !item.pendente, numeroPasso);
    return igual;
  }
  if (passo.ferramenta === "atualizar_valor_dos_fixos") {
    const updates = Array.isArray(passo.args.updates) ? passo.args.updates : [];
    let proximos = itens;
    const tocados: Item[] = [];
    for (const bruto of updates) {
      const update = registro(bruto);
      const id = update?.id;
      const cents = update?.cents;
      if (typeof id !== "string" || typeof cents !== "number") continue;
      proximos = proximos.map((item) => {
        if (item.entryId !== id || !item.fixa) return item;
        const sinal = Math.sign(item.centavos) || -1;
        const mudado = { ...item, centavos: sinal * Math.abs(cents) };
        tocados.push(mudado);
        return mudado;
      });
    }
    if (!tocados.length) return igual;
    return { itens: proximos, fato: fatoDos(numeroPasso, tocados), acrescentados: [] };
  }
  if (passo.ferramenta === "atualizar_ocorrencia") {
    const number = numero(passo.args.number);
    const atual = itens.find((item) => item.entryId === id && item.numero === number);
    if (!atual) return igual;
    if (passo.args.status === "cancelled" || passo.args.status === "refunded") {
      return tirar(itens, (item) => item.entryId === id && item.numero === number, numeroPasso);
    }
    const data = typeof passo.args.dueDate === "string" ? passo.args.dueDate : atual.data;
    const centavos =
      typeof passo.args.plannedCents === "number"
        ? (Math.sign(atual.centavos) || -1) * Math.abs(passo.args.plannedCents)
        : atual.centavos;
    const semEsse = itens.filter((item) => item !== atual);
    if (!data.startsWith(chave)) return { itens: semEsse, fato: fatoDos(numeroPasso, [{ ...atual, data, centavos }]), acrescentados: [] };
    const mudado = { ...atual, data, centavos };
    return { itens: [...semEsse, mudado], fato: fatoDos(numeroPasso, [mudado]), acrescentados: [] };
  }
  return igual;
}

// Os argumentos de criar_lancamento viram a mesma prévia que o formulário mostra.
function lancamentoDoPasso(args: Record<string, unknown>, base: BaseDaRealidade) {
  const category = args.category as CategoriaTransacao | undefined;
  const date = typeof args.date === "string" ? args.date : null;
  const cents = typeof args.cents === "number" ? args.cents : null;
  if (!category || !date || cents === null) return null;
  const { mode } = ajustarTransacao({
    category,
    mode: (args.mode as ModoTransacao | undefined) ?? "outflows",
    priority: "nopriority",
    transactionType: "unusual",
  });
  const recurrence = (args.recurrence as Recorrencia | undefined) ?? null;
  const escolhida = args.dueRule as RegraDeVencimento | undefined;
  const regra = aceitaRegraDeVencimento(category)
    ? normalizarRegra(category, recurrence, escolhida
        ? { ...escolhida, ordem: escolhida.ordem ?? null, contagem: escolhida.contagem ?? "bancaria" }
        : regraPadrao(base.padroes, category, mode))
    : null;
  const previa = regra
    ? proximosVencimentos(
        {
          category,
          date,
          recurrence,
          recurrenceInterval: typeof args.recurrenceInterval === "number" ? args.recurrenceInterval : null,
          installments: typeof args.installments === "number" ? args.installments : null,
        },
        regra,
        base.calendario,
        3,
      )
    : [{ data: date, base: date, feriado: null }];
  return {
    nome: typeof args.name === "string" && args.name.trim() ? args.name.trim() : "O lançamento",
    centavos: mode === "inflows" ? cents : -cents,
    fixa: category === "fixed",
    previa,
  };
}

function itensNoMes(entries: Lancamento[], chave: string): Item[] {
  return entries.flatMap((entry) =>
    ocorrenciasDoLancamento(entry)
      .filter((item) => item.dueDate.startsWith(chave) && (item.status === "pending" || item.status === "completed"))
      .map((item) => ({
        entryId: entry.id,
        numero: item.number,
        data: item.dueDate,
        centavos: valorDaOcorrencia(item),
        fixa: entry.category === "fixed",
        nome: entry.name,
        pendente: item.status === "pending",
      })),
  );
}

function datasDaEntrada(base: BaseDaRealidade, id: unknown) {
  const entry = base.entries.find((item) => item.id === id);
  if (!entry) return [];
  return ocorrenciasDoLancamento(entry)
    .filter((item) => item.status === "pending" || item.status === "completed")
    .map((item) => item.dueDate);
}

function datasDaOcorrencia(base: BaseDaRealidade, id: unknown, number: unknown) {
  const entry = base.entries.find((item) => item.id === id);
  const alvo = numero(number);
  if (!entry || !alvo) return [];
  return ocorrenciasDoLancamento(entry)
    .filter((item) => item.number === alvo)
    .map((item) => item.dueDate);
}

function noMesDoPasso(passo: PassoValidado, chave: string) {
  const year = numero(passo.args.year);
  const month = numero(passo.args.month);
  return Boolean(year && month && `${year}-${String(month).padStart(2, "0")}` === chave);
}

function tirar(itens: Item[], fica: (item: Item) => boolean, passo: number): Efeito {
  const saem = itens.filter(fica);
  if (!saem.length) return { itens, fato: null, acrescentados: [] };
  return { itens: itens.filter((item) => !fica(item)), fato: fatoDos(passo, saem), acrescentados: [] };
}

function fatoDos(passo: number, itens: Item[]): FatoDoPasso {
  return {
    passo,
    valorCents: soma(itens),
    recorrente: itens.some((item) => item.fixa),
    datas: itens.map((item) => ({ data: item.data, base: item.data, feriado: null })),
  };
}

function itemDo(entryId: string, data: string, centavos: number, fixa: boolean, nome: string): Item {
  return { entryId, numero: 0, data, centavos, fixa, nome, pendente: true };
}

function soma(itens: Item[]) {
  return itens.reduce((total, item) => total + item.centavos, 0);
}

function numero(valor: unknown) {
  return typeof valor === "number" && Number.isInteger(valor) ? valor : null;
}

function registro(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" ? (valor as Record<string, unknown>) : null;
}

function dia(data: string) {
  return String(Number(data.slice(8, 10)));
}
