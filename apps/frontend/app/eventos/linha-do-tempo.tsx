import type { ReactNode } from "react";
import type { Evento, HistoricoEvento } from "@finnagent/contracts";
import { cn, focusRing } from "../../components/ui/cn";
import { diaNoFuso, hora, intervalo, rotuloDoDia } from "./formato";
import { TOM_DO_RESULTADO, TOM_DO_STATUS, Trilho } from "./status";

function agruparPorDia<T>(itens: T[], diaDe: (item: T) => string) {
  const grupos: Array<{ dia: string; itens: T[] }> = [];
  for (const item of itens) {
    const dia = diaDe(item);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.itens.push(item);
    else grupos.push({ dia, itens: [item] });
  }
  return grupos;
}

// A lista vem do mais novo ao mais antigo; cada dia ganha um cabeçalho que gruda no topo ao rolar.
export function PorDia<T>({
  itens,
  quando,
  fuso,
  hoje,
  chave,
  linha,
}: {
  itens: T[];
  quando: (item: T) => string;
  fuso: string;
  hoje: string;
  chave: (item: T) => string;
  linha: (item: T) => ReactNode;
}) {
  return (
    <div className="grid min-w-0">
      {agruparPorDia(itens, (item) => diaNoFuso(quando(item), fuso)).map((grupo, indice) => (
        <section key={grupo.dia} aria-label={rotuloDoDia(grupo.dia, hoje)} className="min-w-0">
          {/* A regra de h1/h2/h3 do globals.css vence os utilitários; a etiqueta vai no span de dentro. */}
          <h3 className={cn("sticky top-0 z-10 border-b border-line bg-surface-2 px-4 py-2", indice > 0 && "border-t")}>
            <span className="etiqueta text-ink-2">{rotuloDoDia(grupo.dia, hoje)}</span>
          </h3>
          <ol className="min-w-0">
            {grupo.itens.map((item) => (
              <li key={chave(item)} className="min-w-0">
                {linha(item)}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

const linha = "flex w-full min-w-0 items-stretch gap-3 border-l-2 pr-4 pl-3 text-left transition-colors";

export function LinhaDoEvento({
  evento,
  fuso,
  categoria,
  aberta,
  onAbrir,
}: {
  evento: Evento;
  fuso: string;
  categoria: string;
  aberta: boolean;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-current={aberta || undefined}
      className={cn(linha, aberta ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface-2", focusRing)}
    >
      <time dateTime={evento.occurredAt} className="w-12 shrink-0 py-3 font-mono text-xs leading-5 text-ink-2">
        {hora(evento.occurredAt, fuso)}
      </time>
      <Trilho status={evento.status} />
      <span className="grid min-w-0 flex-1 gap-1 py-3">
        <span className="truncate font-mono text-sm font-semibold">{evento.type}</span>
        <span className="truncate text-xs text-ink-2">{evento.aggregate}</span>
      </span>
      <span className="etiqueta hidden shrink-0 py-3 leading-5 text-ink-2 tab:block">{categoria}</span>
      {evento.status === "concluído" ? (
        <span className="sr-only">concluído</span>
      ) : (
        <span className={cn("etiqueta shrink-0 py-3 leading-5", TOM_DO_STATUS[evento.status])}>{evento.status}</span>
      )}
    </button>
  );
}

export function LinhaDoHistorico({
  linha: registro,
  fuso,
  aberta,
  onAbrir,
}: {
  linha: HistoricoEvento;
  fuso: string;
  aberta: boolean;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-current={aberta || undefined}
      className={cn(linha, aberta ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface-2", focusRing)}
    >
      <time dateTime={registro.occurredAt} className="w-12 shrink-0 py-3 font-mono text-xs leading-5 text-ink-2">
        {hora(registro.occurredAt, fuso)}
      </time>
      <Trilho resultado={registro.result} />
      <span className="grid min-w-0 flex-1 gap-1 py-3">
        <span className="truncate font-mono text-sm font-semibold">{registro.eventType}</span>
        <span className="truncate text-xs text-ink-2">
          {registro.consumer} · tentativa {registro.attempt}
        </span>
        {registro.error ? <span className="text-xs break-words text-neg">{registro.error}</span> : null}
      </span>
      <span className="shrink-0 py-3 text-xs leading-5 text-ink-2 tabular-nums">
        {registro.durationMs === null ? "—" : intervalo(registro.durationMs)}
      </span>
      {registro.result === "sucesso" ? (
        <span className="sr-only">sucesso</span>
      ) : (
        <span className={cn("etiqueta shrink-0 py-3 leading-5", TOM_DO_RESULTADO[registro.result])}>
          {registro.result}
        </span>
      )}
    </button>
  );
}
