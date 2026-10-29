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

type Lancado = { passo: number; nome: string; centavos: number; fixa: boolean; datas: string[] };

/**
 * Mede o plano antes da aprovação, pela mesma conta que o sistema usa para gravar: as próximas datas de cada
 * lançamento (fim de semana, feriado da conta e regra de vencimento), a sobra do mês antes e depois, e os
 * alertas de consultor. O modelo não entra aqui: os números saem do sistema.
 */
export function fatosDoPlano(passos: PassoValidado[], base: BaseDaRealidade): FatosDoPlano {
  const lancados: Lancado[] = [];
  const fatos: FatoDoPasso[] = [];
  for (const [indice, passo] of passos.entries()) {
    if (passo.ferramenta !== "criar_lancamento") continue;
    const lancado = lancamentoDoPasso(indice + 1, passo.args, base);
    if (!lancado) continue;
    lancados.push({ ...lancado, datas: lancado.previa.map((item) => item.data) });
    fatos.push({ passo: indice + 1, valorCents: lancado.centavos, recorrente: lancado.fixa, datas: lancado.previa });
  }
  if (!lancados.length) return { mes: null, passos: fatos, alertas: [] };

  // O mês que o plano mexe: o primeiro em que cai um lançamento novo, nunca antes do mês de hoje.
  const hoje = base.hoje.slice(0, 7);
  const primeiro = lancados.flatMap((item) => item.datas).filter((data) => data.slice(0, 7) >= hoje).sort()[0] ?? base.hoje;
  const chave = primeiro.slice(0, 7);
  const [ano, mes] = chave.split("-").map(Number) as [number, number];

  const existentes = ocorrenciasNoMes(base.entries, chave);
  const novas = lancados.flatMap((item) =>
    item.datas.filter((data) => data.startsWith(chave)).map((data) => ({ data, centavos: item.centavos, fixa: item.fixa, nome: item.nome })),
  );
  const sobraAntes = existentes.reduce((soma, item) => soma + item.centavos, 0);
  const sobraDepois = sobraAntes + novas.reduce((soma, item) => soma + item.centavos, 0);

  const alertas: string[] = [];
  const nomeDoMes = MESES[mes - 1] ?? chave;
  if (sobraDepois < 0) alertas.push(`A sobra de ${nomeDoMes} fica em ${reais.format(sobraDepois / 100)}.`);

  const todas = [...existentes, ...novas];
  const entradas = todas.filter((item) => item.centavos > 0);
  const primeiraEntrada = entradas.map((item) => item.data).sort()[0];
  if (primeiraEntrada) {
    for (const conta of novas.filter((item) => item.centavos < 0 && item.data < primeiraEntrada)) {
      alertas.push(
        `${conta.nome} vence dia ${dia(conta.data)}, antes da primeira entrada de ${nomeDoMes} (dia ${dia(primeiraEntrada)}).`,
      );
    }
  }
  const renda = entradas.reduce((soma, item) => soma + item.centavos, 0);
  const fixas = -todas.filter((item) => item.centavos < 0 && item.fixa).reduce((soma, item) => soma + item.centavos, 0);
  if (renda > 0 && fixas > renda / 2) {
    alertas.push(`As contas fixas somam ${Math.round((fixas / renda) * 100)}% das entradas de ${nomeDoMes}.`);
  }

  return { mes: { ano, mes, sobraAntesCents: sobraAntes, sobraDepoisCents: sobraDepois }, passos: fatos, alertas };
}

// Os argumentos de criar_lancamento viram a mesma prévia que o formulário mostra.
function lancamentoDoPasso(passo: number, args: Record<string, unknown>, base: BaseDaRealidade) {
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
    passo,
    nome: typeof args.name === "string" && args.name.trim() ? args.name.trim() : "O lançamento",
    centavos: mode === "inflows" ? cents : -cents,
    fixa: category === "fixed",
    previa,
  };
}

function ocorrenciasNoMes(entries: Lancamento[], chave: string) {
  return entries.flatMap((entry) =>
    ocorrenciasDoLancamento(entry)
      .filter((item) => item.dueDate.startsWith(chave) && (item.status === "pending" || item.status === "completed"))
      .map((item) => ({ data: item.dueDate, centavos: valorDaOcorrencia(item), fixa: entry.category === "fixed", nome: entry.name })),
  );
}

function dia(data: string) {
  return String(Number(data.slice(8, 10)));
}
