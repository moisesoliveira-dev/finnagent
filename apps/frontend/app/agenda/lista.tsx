import type { StatusCompromisso } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { cn } from "../../components/ui/cn";
import { List } from "../../components/ui/list";
import { Money } from "../../components/ui/money";
import { ehHoje, itensNoDia, rotuloDaCategoria, rotuloDoDia, rotuloDoStatus, statusDoDia, type ItemDia } from "./itens";

export function ListaMes({
  year,
  month,
  itens,
  onStatus,
}: {
  year: number;
  month: number;
  itens: ItemDia[];
  onStatus: (id: string, status: StatusCompromisso) => void;
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
          <ListaDoDia year={year} month={month} day={day} itens={itensNoDia(itens, day)} onStatus={onStatus} />
        </section>
      ))}
    </div>
  );
}

export function ListaDoDia({
  year,
  month,
  day,
  itens,
  onStatus,
}: {
  year: number;
  month: number;
  day: number;
  itens: ItemDia[];
  onStatus: (id: string, status: StatusCompromisso) => void;
}) {
  if (itens.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-ink-2">Nada neste dia.</div>
    );
  }
  return (
    <List>
      {itens.map((item) => (
        <Linha key={item.id} year={year} month={month} day={day} item={item} onStatus={onStatus} />
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
}: {
  year: number;
  month: number;
  day: number;
  item: ItemDia;
  onStatus: (id: string, status: StatusCompromisso) => void;
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
        <div className="font-medium">{item.title}</div>
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
        {item.status ? (
          <Button variant="quiet" onClick={() => onStatus(item.id, proximo)}>
            {item.status === "done" ? "Marcar descumprido" : "Marcar cumprido"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

