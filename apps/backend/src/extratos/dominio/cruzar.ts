import {
  categoriaDeCompromisso,
  ocorrenciasDoLancamento,
  type CategoriaTransacao,
  type Lancamento,
  type OrigemDaProposta,
  type ValorDoMes,
  type VinculoCruzado,
} from "@finnagent/contracts";

export type LancamentoCruzavel = VinculoCruzado & { sessionId: string; vagas: number };

export type LinhaParaCruzar = { date: string; cents: number };

export type NomeLembrado = { entryId: string | null; sessionId: string };

export function cruzaveisDoMes(
  entries: Lancamento[],
  vinculadas: (string | null)[],
  year: number,
  month: number,
): LancamentoCruzavel[] {
  const mes = `${year}-${String(month).padStart(2, "0")}`;
  const usadas = new Map<string, number>();
  for (const id of vinculadas) if (id) usadas.set(id, (usadas.get(id) ?? 0) + 1);
  return entries.flatMap((entry) => {
    const doMes = (entry.occurrences ?? []).filter(
      (item) => item.dueDate.startsWith(mes) && (item.status === "pending" || item.status === "completed"),
    );
    if (doMes.length === 0) return [];
    const alvo = doMes.find((item) => item.status === "pending") ?? doMes[0];
    return [
      {
        entryId: entry.id,
        description: entry.name || entry.description,
        groupName: entry.groupName,
        sessionName: entry.sessionName,
        sessionId: entry.sessionId,
        day: Number(alvo.dueDate.slice(8, 10)),
        cents: alvo.plannedCents,
        category: entry.category,
        vagas: doMes.length - (usadas.get(entry.id) ?? 0),
      },
    ];
  });
}

export function cabeNaLinha(linha: LinhaParaCruzar, item: LancamentoCruzavel) {
  if (item.vagas <= 0 || item.cents === 0 || linha.cents === 0) return false;
  if (item.category === "additional") return linha.cents > 0 && item.cents > 0;
  return Math.sign(item.cents) === Math.sign(linha.cents);
}

// `cabeNaLinha` já barra extra com saída; esta checagem protege quem chamar `valorDoMes` direto.
const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** A ocorrência do mês que o cruzamento paga: a pendente, ou a já contada se não houver pendente. */
export function ocorrenciaContada(entry: Lancamento, date: string) {
  const chave = date.slice(0, 7);
  const lista = ocorrenciasDoLancamento(entry).filter(
    (item) => item.dueDate.startsWith(chave) && (item.status === "pending" || item.status === "completed"),
  );
  return lista.find((item) => item.status === "pending") ?? lista[0] ?? null;
}

export function valorContado(entry: Lancamento, date: string) {
  const item = ocorrenciaContada(entry, date);
  if (!item) return null;
  return item.status === "completed" && item.paidCents != null ? item.paidCents : item.plannedCents;
}

/**
 * O valor que o cruzamento põe no mês, e a frase que o cartão mostra. Recusa extra em saída e
 * fixa, parcela ou empréstimo divergentes sem a escolha da pessoa.
 */
export function preparoDoCruzamento(
  category: CategoriaTransacao,
  planejado: number,
  extrato: number,
  escolha?: ValorDoMes,
): { cents: number; nota: string } | string {
  const centavos = valorDoMes(category, planejado, extrato, escolha);
  if (centavos === "extra") return "Adicional só cruza com entrada.";
  if (centavos === "escolha") {
    return `Os valores divergem (${reais.format(extrato / 100)} no extrato, ${reais.format(planejado / 100)} no lançamento). Pergunte à pessoa qual vale neste mês e mande valor "extrato" ou "lancamento".`;
  }
  return { cents: centavos, nota: notaDoCruzamento(category, planejado, extrato, centavos) };
}

function notaDoCruzamento(category: CategoriaTransacao, planejado: number, extrato: number, centavos: number) {
  if (category === "additional") return "Adicional, no valor do extrato.";
  if (!categoriaDeCompromisso(category)) {
    return planejado === extrato ? "" : `Única: neste mês vale o extrato, ${reais.format(extrato / 100)}.`;
  }
  if (planejado === extrato) return "";
  if (centavos === extrato) {
    return `Neste mês vale o extrato, ${reais.format(extrato / 100)}. O lançamento está em ${reais.format(planejado / 100)}.`;
  }
  return `Neste mês vale o lançamento, ${reais.format(planejado / 100)}. O extrato está em ${reais.format(extrato / 100)}.`;
}

export function valorDoMes(
  category: CategoriaTransacao,
  planejado: number,
  extrato: number,
  escolha?: ValorDoMes,
): number | "escolha" | "extra" {
  if (category === "additional" && (extrato < 0 || planejado < 0)) return "extra";
  if (!categoriaDeCompromisso(category) || planejado === extrato) return extrato;
  if (escolha === "extrato") return extrato;
  if (escolha === "lancamento") return planejado;
  return "escolha";
}

export function candidatosDaLinha(linha: LinhaParaCruzar, lancamentos: LancamentoCruzavel[]) {
  const dia = Number(linha.date.slice(8, 10));
  return lancamentos
    .filter((item) => cabeNaLinha(linha, item))
    .sort(
      (a, b) =>
        Number(b.cents === linha.cents) - Number(a.cents === linha.cents) ||
        Math.abs(a.day - dia) - Math.abs(b.day - dia) ||
        Math.abs(a.cents - linha.cents) - Math.abs(b.cents - linha.cents) ||
        a.description.localeCompare(b.description, "pt-BR"),
    );
}

export function propostaDaLinha(
  linha: LinhaParaCruzar,
  candidatos: LancamentoCruzavel[],
  lembrado: NomeLembrado | undefined,
): { suggestion: LancamentoCruzavel; source: OrigemDaProposta } | null {
  const doNome = lembrado?.entryId ? candidatos.find((item) => item.entryId === lembrado.entryId) : undefined;
  if (doNome) return { suggestion: doNome, source: "nome" };
  const dia = Number(linha.date.slice(8, 10));
  const exatos = candidatos.filter((item) => item.cents === linha.cents && Math.abs(item.day - dia) <= 3);
  if (exatos.length !== 1) return null;
  return { suggestion: exatos[0], source: "valor" };
}

export function vinculoDoCruzavel({ sessionId: _sessionId, vagas: _vagas, ...vinculo }: LancamentoCruzavel): VinculoCruzado {
  return vinculo;
}
