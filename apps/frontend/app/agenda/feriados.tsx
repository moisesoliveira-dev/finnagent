import { ROTULO_DO_TIPO_DE_FERIADO, type Feriado, type TipoDeFeriado } from "@finnagent/contracts";
import { Chip } from "../../components/ui/chip";
import { cn } from "../../components/ui/cn";

const TIPO_CURTO: Record<TipoDeFeriado, string> = {
  nacional: "Nacional",
  bancario: "Bancos fechados",
  facultativo: "Facultativo",
  local: "Local",
};

export function feriadosNoDia(feriados: Feriado[], day: number) {
  return feriados.filter((item) => Number(item.data.slice(8, 10)) === day);
}

/** Nacional e local fecham tudo; o ponto facultativo pesa menos na tela. */
export function fechaTudo(feriado: Feriado) {
  return feriado.tipo === "nacional" || feriado.tipo === "local";
}

export function descricaoDoFeriado(feriado: Feriado) {
  return `${feriado.nome}, ${ROTULO_DO_TIPO_DE_FERIADO[feriado.tipo].toLowerCase()}`;
}

/** Selo do feriado no título do dia, ao lado do "Hoje". */
export function SelosDoFeriado({ feriados }: { feriados: Feriado[] }) {
  return feriados.map((item) => (
    <Chip key={`${item.data}-${item.nome}`} tone="event" title={ROTULO_DO_TIPO_DE_FERIADO[item.tipo]}>
      {item.nome} · {TIPO_CURTO[item.tipo]}
    </Chip>
  ));
}

/** O feriado como uma linha da lista do mês, na coluna da hora: "Feriado", o nome e o tipo. */
export function LinhaDoFeriado({ feriado }: { feriado: Feriado }) {
  return (
    <li className="flex min-w-0 items-start gap-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className="etiqueta w-16 shrink-0 leading-6 text-event">Feriado</span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className={cn("truncate font-medium", fechaTudo(feriado) ? "text-ink" : "text-ink-2")} title={descricaoDoFeriado(feriado)}>
          {feriado.nome}
        </span>
        <span className="text-sm text-ink-2">{TIPO_CURTO[feriado.tipo]}</span>
      </span>
    </li>
  );
}

/** Nome do feriado dentro da célula da grade. */
export function NomeDoFeriado({ feriado }: { feriado: Feriado }) {
  return (
    <span
      title={descricaoDoFeriado(feriado)}
      className={cn("etiqueta truncate", fechaTudo(feriado) ? "text-ink" : "text-ink-2")}
    >
      {feriado.nome}
    </span>
  );
}
