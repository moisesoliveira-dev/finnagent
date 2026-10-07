import { Chip } from "../../components/ui/chip";
import { Money } from "../../components/ui/money";
import { ehHoje, itensNoDia, rotuloDaCategoria, rotuloDoDia, statusDoDia, type ItemDia } from "./itens";

export function ListaMes({
  year,
  month,
  itens,
}: {
  year: number;
  month: number;
  itens: ItemDia[];
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
    <div>
      {dias.map((day) => (
        <section key={day} className="mt-6 first:mt-0">
          <h2 className="mb-3 flex flex-wrap items-center gap-2 font-display text-lg">
            {rotuloDoDia(year, month, day)}
            {ehHoje(year, month, day) ? (
              <Chip tone="ok" className="font-sans font-normal">
                Hoje
              </Chip>
            ) : null}
          </h2>
          <ListaDoDia year={year} month={month} day={day} itens={itensNoDia(itens, day)} />
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
}: {
  year: number;
  month: number;
  day: number;
  itens: ItemDia[];
}) {
  if (itens.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-ink-2">Nada neste dia.</div>
    );
  }
  return (
    <ul className="overflow-hidden rounded-lg border border-line bg-surface">
      {itens.map((item) => (
        <Linha key={item.id} year={year} month={month} day={day} item={item} />
      ))}
    </ul>
  );
}

function Linha({
  year,
  month,
  day,
  item,
}: {
  year: number;
  month: number;
  day: number;
  item: ItemDia;
}) {
  const status = item.link ? statusDoDia(year, month, day) : null;
  return (
    <li
      className={`grid grid-cols-[56px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 tab:grid-cols-[56px_minmax(0,1fr)_auto] ${
        item.kind === "compromisso" ? "border-l-4 border-l-event pl-3" : ""
      }`}
    >
      <time className="pt-0.5 text-sm text-ink-2">{item.time ?? "Dia todo"}</time>
      <div className="min-w-0">
        <div className="font-medium">{item.title}</div>
        <div className="mt-0.5 flex flex-wrap gap-2">
          <Chip>{item.kind === "compromisso" ? item.calendar : "Lançamento"}</Chip>
          {item.category ? <Chip>{rotuloDaCategoria(item.category)}</Chip> : null}
          {item.link ? (
            <Chip>
              {item.kind === "compromisso" ? "Vinculado · " : ""}
              {item.link.groupName} › {item.link.sessionName}
            </Chip>
          ) : null}
          {status ? <Chip tone={status === "pago" ? "ok" : "default"}>{status}</Chip> : null}
        </div>
      </div>
      {item.link ? (
        <div className="col-start-2 tab:col-start-auto">
          <Money cents={item.link.cents} strong />
        </div>
      ) : null}
    </li>
  );
}

