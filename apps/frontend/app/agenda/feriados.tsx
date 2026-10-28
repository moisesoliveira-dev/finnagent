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
    <Chip key={`${item.data}-${item.nome}`} title={ROTULO_DO_TIPO_DE_FERIADO[item.tipo]}>
      {item.nome} · {TIPO_CURTO[item.tipo]}
    </Chip>
  ));
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
