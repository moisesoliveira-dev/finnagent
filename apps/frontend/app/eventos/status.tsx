import type { ResultadoHistorico, StatusEvento } from "@finnagent/contracts";
import { cn } from "../../components/ui/cn";

// "Concluído" é o caso normal: anel vazio e sem nome escrito na linha. Os outros são cheios e sempre vêm
// com o nome ao lado, porque pendente e falha se confundem só pela cor.
const PONTO: Record<StatusEvento, string> = {
  "concluído": "border-2 border-brand bg-surface",
  processando: "bg-ink-2",
  pendente: "bg-pending",
  "com falha": "bg-neg",
};

const PONTO_DO_RESULTADO: Record<ResultadoHistorico, string> = {
  sucesso: PONTO["concluído"],
  iniciado: PONTO.processando,
  falha: PONTO["com falha"],
};

export const TOM_DO_STATUS: Record<StatusEvento, string> = {
  "concluído": "text-brand",
  processando: "text-ink-2",
  pendente: "text-pending",
  "com falha": "text-neg",
};

export const TOM_DO_RESULTADO: Record<ResultadoHistorico, string> = {
  sucesso: TOM_DO_STATUS["concluído"],
  iniciado: TOM_DO_STATUS.processando,
  falha: TOM_DO_STATUS["com falha"],
};

/** A ordem em que a tela mostra os status: o normal primeiro, depois o que pede atenção. */
export const ORDEM_DOS_STATUS: readonly StatusEvento[] = ["concluído", "processando", "pendente", "com falha"];

export const STATUS_NO_PLURAL: Record<StatusEvento, string> = {
  "concluído": "Concluídos",
  processando: "Processando",
  pendente: "Pendentes",
  "com falha": "Com falha",
};

export function Ponto({ status, resultado }: { status?: StatusEvento; resultado?: ResultadoHistorico }) {
  const classe = status ? PONTO[status] : resultado ? PONTO_DO_RESULTADO[resultado] : "bg-line";
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", classe)} />;
}

/** A coluna do trilho da linha do tempo: o fio que liga as linhas e o ponto do status. */
export function Trilho({ status, resultado }: { status?: StatusEvento; resultado?: ResultadoHistorico }) {
  return (
    <span aria-hidden="true" className="relative flex w-2 shrink-0 justify-center">
      <span className="absolute inset-y-0 left-1/2 border-l border-line" />
      <span className="relative mt-4 flex">
        <Ponto status={status} resultado={resultado} />
      </span>
    </span>
  );
}
