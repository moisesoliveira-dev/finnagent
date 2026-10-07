import { cn, focusRing } from "../../components/ui/cn";
import { diasDoMes, itensNoDia, rotuloDoDia, type ItemDia } from "./itens";

const semana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function GradeMes({
  year,
  month,
  selected,
  today,
  itens,
  onSelect,
  onContext,
}: {
  year: number;
  month: number;
  selected: number;
  today: number | null;
  itens: ItemDia[];
  onSelect: (day: number) => void;
  onContext: (day: number, x: number, y: number) => void;
}) {
  const dias = diasDoMes(year, month);
  const inicio = new Date(year, month - 1, 1).getDay();
  const anterior = new Date(year, month - 1, 0).getDate();
  const total = Math.ceil((inicio + dias) / 7) * 7;
  const celulas: Array<{ tipo: "fora"; numero: number } | { tipo: "dia"; numero: number }> = Array.from(
    { length: total },
    (_, index) => {
      const day = index - inicio + 1;
      if (day < 1) return { tipo: "fora" as const, numero: anterior + day };
      if (day > dias) return { tipo: "fora" as const, numero: day - dias };
      return { tipo: "dia" as const, numero: day };
    },
  );

  return (
    <section aria-label="Calendário do mês">
      <div className="mb-1 grid grid-cols-7 text-center text-xs text-ink-2" aria-hidden="true">
        {semana.map((nome) => (
          <span key={nome}>{nome}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {celulas.map((celula, index) => {
          if (celula.tipo === "fora") {
            return (
              <div key={`fora-${index}`} className="min-h-[68px] bg-surface-2 p-1 text-ink-2 tab:min-h-[108px] tab:p-2">
                <span className="grid size-6 place-items-center text-sm font-semibold">{celula.numero}</span>
              </div>
            );
          }
          const day = celula.numero;
          const doDia = itensNoDia(itens, day);
          const compromissos = doDia.filter((item) => item.kind === "compromisso");
          const lancamentos = doDia.filter((item) => item.kind === "lancamento");
          return (
            <button
              key={`dia-${day}`}
              type="button"
              data-dia={day}
              aria-haspopup="menu"
              aria-pressed={day === selected}
              aria-label={`${rotuloDoDia(year, month, day)}, ${doDia.length} itens`}
              className={cn(
                "flex min-h-[68px] flex-col items-stretch gap-1 bg-surface p-1 text-left tab:min-h-[108px] tab:p-2",
                day === selected
                  ? "outline-solid outline-2 -outline-offset-2 outline-brand focus-visible:ring-3 focus-visible:ring-brand/40"
                  : focusRing,
              )}
              onClick={() => onSelect(day)}
              onContextMenu={(event) => {
                event.preventDefault();
                const x = event.clientX;
                const y = event.clientY;
                onContext(day, x, y);
              }}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center self-start rounded-sm text-sm font-semibold",
                  day === today && "bg-brand text-brand-ink",
                )}
              >
                {day}
              </span>
              <span className="hidden min-w-0 flex-col gap-0.5 tab:flex">
                {compromissos.slice(0, 2).map((item) => (
                  <span
                    key={`${item.id}-chip`}
                    className="flex min-w-0 items-center gap-1 rounded-sm bg-event-soft px-1 text-xs leading-snug text-event"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    {item.link ? <span className="font-semibold">R$</span> : null}
                  </span>
                ))}
                {compromissos.length > 2 ? (
                  <span className="text-xs text-ink-2">+{compromissos.length - 2} mais</span>
                ) : null}
              </span>
              <span className="mt-auto flex flex-wrap gap-[3px]">
                {doDia.slice(0, 4).map((item) => (
                  <span
                    key={item.id}
                    aria-hidden
                    className={cn("size-1.5 rounded-full tab:hidden", corDoPonto(item))}
                  />
                ))}
                {lancamentos.slice(0, 4).map((item) => (
                  <span
                    key={`${item.id}-mesa`}
                    aria-hidden
                    className={cn("hidden size-1.5 rounded-full tab:inline-block", corDoPonto(item))}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 max-w-prose text-sm text-ink-2">
        Clique com o botão direito em um dia (ou toque, no celular) para abrir os itens dele. “R$” no
        compromisso indica uma transação vinculada. O ponto vermelho é saída e o verde, entrada.
      </p>
    </section>
  );
}

function corDoPonto(item: ItemDia) {
  if (item.kind === "compromisso") return "bg-event";
  return item.link && item.link.cents < 0 ? "bg-neg" : "bg-pos";
}

