import { useState } from "react";
import type { StatusCompromisso } from "@finnagent/contracts";
import { Chip } from "../../components/ui/chip";
import { cn } from "../../components/ui/cn";
import { List } from "../../components/ui/list";
import { Money } from "../../components/ui/money";
import { ItemAnimado, ListaAnimada } from "../../components/ui/movimento";
import { ehHoje, itensNoDia, rotuloDaCategoria, rotuloDoDia, rotuloDoStatus, statusDoDia, type ItemDia } from "./itens";

export function ListaMes({
  year,
  month,
  itens,
  onStatus,
  onEdit,
}: {
  year: number;
  month: number;
  itens: ItemDia[];
  onStatus: (id: string, status: StatusCompromisso) => void;
  onEdit: (id: string) => void;
}) {
  const dias = [...new Set(itens.map((item) => item.day))].sort((a, b) => a - b);
  if (dias.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-ink-2">
        Nenhum item com os filtros atuais.
      </div>
    );
  }
  return (
    <div className="grid min-w-0 gap-8">
      {dias.map((day) => (
        <section key={day} className="grid min-w-0 gap-3">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-lg">
            {rotuloDoDia(year, month, day)}
            {ehHoje(year, month, day) ? (
              <Chip tone="ok" className="font-sans font-normal">
                Hoje
              </Chip>
            ) : null}
          </h2>
          <ListaDoDia year={year} month={month} day={day} itens={itensNoDia(itens, day)} onStatus={onStatus} onEdit={onEdit} />
        </section>
      ))}
    </div>
  );
}

export function resumoDoDia(itens: ItemDia[]) {
  const total = itens.reduce((soma, item) => soma + (item.link?.cents ?? 0), 0);
  return { quantidade: itens.length, total, temValor: itens.some((item) => item.link) };
}

export function PainelDoDia({
  year,
  month,
  day,
  itens,
  onStatus,
  onEdit,
  onDelete,
}: {
  year: number;
  month: number;
  day: number;
  itens: ItemDia[];
  onStatus: (id: string, status: StatusCompromisso) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmar, setConfirmar] = useState<string | null>(null);
  if (itens.length === 0) {
    return <p className="py-6 text-sm text-ink-2">Nada neste dia.</p>;
  }
  return (
    <ListaAnimada>
      {itens.map((item) => (
        <ItemDoDia
          key={item.id}
          year={year}
          month={month}
          day={day}
          item={item}
          onStatus={onStatus}
          onEdit={onEdit}
          confirmar={confirmar === item.id}
          onExcluir={() => {
            if (item.kind !== "compromisso") return;
            if (confirmar === item.id) {
              setConfirmar(null);
              onDelete(item.id);
              return;
            }
            setConfirmar(item.id);
          }}
        />
      ))}
    </ListaAnimada>
  );
}

function ItemDoDia({
  year,
  month,
  day,
  item,
  onStatus,
  onEdit,
  confirmar,
  onExcluir,
}: {
  year: number;
  month: number;
  day: number;
  item: ItemDia;
  onStatus: (id: string, status: StatusCompromisso) => void;
  onEdit: (id: string) => void;
  confirmar: boolean;
  onExcluir: () => void;
}) {
  const pagamento = item.link ? statusDoDia(year, month, day) : null;
  const meta = metaDoItem(item);
  const proximo = item.status === "done" ? "undone" : "done";
  return (
    <ItemAnimado className="relative border-b border-line py-4 pl-3 last:border-b-0">
      <span className={cn("absolute inset-y-3 left-0 w-1 rounded-sm", faixaDoItem(item))} aria-hidden />
      <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-4">
        <time className="pt-1 text-xs text-ink-2">{item.time ?? "Dia todo"}</time>
        <div className="grid min-w-0 gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="min-w-0 truncate font-medium">{item.title}</h3>
            <span className="flex shrink-0 items-center gap-1">
              {item.kind === "compromisso" ? (
                <>
                  <button
                    type="button"
                    aria-label="Editar"
                    className="grid size-8 place-items-center rounded-sm text-ink-2! hover:bg-surface-2 hover:text-ink!"
                    onClick={() => onEdit(item.id)}
                  >
                    <IconeEditar />
                  </button>
                  <button
                    type="button"
                    aria-label={confirmar ? "Confirmar exclusão" : "Excluir"}
                    className={cn(
                      "grid size-8 place-items-center rounded-sm hover:bg-surface-2",
                      confirmar ? "text-neg!" : "text-ink-2! hover:text-neg!",
                    )}
                    onClick={onExcluir}
                  >
                    <IconeExcluir />
                  </button>
                </>
              ) : null}
              {item.link ? <Money cents={item.link.cents} strong /> : null}
            </span>
          </div>
          {item.description ? <p className="line-clamp-2 text-sm text-ink-2">{item.description}</p> : null}
          {item.location ? <p className="text-sm text-ink-2">{item.location}</p> : null}
          <p className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-ink-2">
            <span>{categoriaDoItem(item)}</span>
            {meta.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="min-w-0 truncate">{meta.join(" · ")}</span>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {pagamento ? (
                <Chip tone={pagamento === "pago" ? "ok" : "ai"}>
                  {pagamento === "pago" ? "Pago" : "Pendente"}
                </Chip>
              ) : null}
              {item.status ? (
                <Chip tone={item.status === "done" ? "ok" : "ai"}>{rotuloDoStatus(item.status)}</Chip>
              ) : null}
            </div>
            {item.status ? <OkCompromisso feito={item.status === "done"} onChange={() => onStatus(item.id, proximo)} /> : null}
          </div>
        </div>
      </div>
    </ItemAnimado>
  );
}

function OkCompromisso({ feito, onChange }: { feito: boolean; onChange: () => void }) {
  return (
    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={feito}
        onChange={onChange}
        aria-label={feito ? "Desmarcar cumprido" : "Marcar como cumprido"}
        className="size-4 accent-brand"
      />
      <span className={cn("font-semibold", feito ? "text-brand" : "text-ink-2")}>OK!</span>
    </label>
  );
}

function IconeEditar() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M10 2.5 13.5 6 6 13.5H2.5V10L10 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeExcluir() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 4.5h10M6 4.5V3h4v1.5M4.2 4.5 4.7 13h6.6l.5-8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function faixaDoItem(item: ItemDia) {
  if ((item.link?.cents ?? 0) < 0) return "bg-neg";
  if ((item.link?.cents ?? 0) > 0) return "bg-pos";
  return "bg-event";
}

function categoriaDoItem(item: ItemDia) {
  if (item.link) return `${item.link.groupName} › ${item.link.sessionName}`;
  if (item.calendar) return item.calendar;
  return "Lançamento";
}

function metaDoItem(item: ItemDia) {
  const partes: string[] = [];
  if (item.calendar && item.link) partes.push(item.calendar);
  if (item.category) partes.push(rotuloDaCategoria(item.category));
  if (item.kind === "compromisso" && item.link) partes.push("Vinculado");
  return partes;
}

export function ListaDoDia({
  year,
  month,
  day,
  itens,
  onStatus,
  onEdit,
}: {
  year: number;
  month: number;
  day: number;
  itens: ItemDia[];
  onStatus: (id: string, status: StatusCompromisso) => void;
  onEdit: (id: string) => void;
}) {
  if (itens.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-ink-2">Nada neste dia.</div>
    );
  }
  return (
    <List>
      {itens.map((item) => (
        <Linha key={item.id} year={year} month={month} day={day} item={item} onStatus={onStatus} onEdit={onEdit} />
      ))}
    </List>
  );
}

function Linha({
  year,
  month,
  day,
  item,
  onStatus,
  onEdit,
}: {
  year: number;
  month: number;
  day: number;
  item: ItemDia;
  onStatus: (id: string, status: StatusCompromisso) => void;
  onEdit: (id: string) => void;
}) {
  const status = item.link ? statusDoDia(year, month, day) : null;
  const proximo = item.status === "done" ? "undone" : "done";
  return (
    <li
      className={cn(
        "grid grid-cols-[56px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 tab:grid-cols-[56px_minmax(0,1fr)_auto]",
        item.kind === "compromisso" && "border-l-4 border-l-event pl-3",
      )}
    >
      <time className="text-sm text-ink-2">{item.time ?? "Dia todo"}</time>
      <div className="flex min-w-0 flex-col gap-1 break-words">
        {item.kind === "compromisso" ? (
          <button type="button" className="text-left font-medium text-ink!" onClick={() => onEdit(item.id)}>
            {item.title}
          </button>
        ) : (
          <div className="font-medium">{item.title}</div>
        )}
        {item.description ? <p className="text-sm text-ink-2">{item.description}</p> : null}
        {item.location ? <p className="text-sm text-ink-2">{item.location}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Chip>{item.kind === "compromisso" ? item.calendar : "Lançamento"}</Chip>
          {item.category ? <Chip>{rotuloDaCategoria(item.category)}</Chip> : null}
          {item.status ? (
            <Chip tone={item.status === "done" ? "ok" : "default"}>{rotuloDoStatus(item.status)}</Chip>
          ) : null}
          {item.link ? (
            <Chip>
              {item.kind === "compromisso" ? "Vinculado · " : ""}
              {item.link.groupName} › {item.link.sessionName}
            </Chip>
          ) : null}
          {status ? <Chip tone={status === "pago" ? "ok" : "default"}>{status}</Chip> : null}
        </div>
      </div>
      <div className="col-start-2 flex flex-wrap items-center justify-end gap-2 tab:col-start-auto">
        {item.link ? <Money cents={item.link.cents} strong /> : null}
        {item.status ? <OkCompromisso feito={item.status === "done"} onChange={() => onStatus(item.id, proximo)} /> : null}
      </div>
    </li>
  );
}

