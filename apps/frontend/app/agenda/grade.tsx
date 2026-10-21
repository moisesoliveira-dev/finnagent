import { useRef, useState } from "react";
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
  onOpen,
  onContext,
  onMove,
}: {
  year: number;
  month: number;
  selected: number;
  today: number | null;
  itens: ItemDia[];
  onSelect: (day: number) => void;
  onOpen: (day: number) => void;
  onContext: (day: number, x: number, y: number) => void;
  onMove: (id: string, day: number) => void;
}) {
  const arrastou = useRef(false);
  const [destino, setDestino] = useState<number | null>(null);
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
      <div className="etiqueta mb-1 grid grid-cols-7 text-center text-ink-2" aria-hidden="true">
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
            <div
              key={`dia-${day}`}
              data-dia={day}
              className={cn(
                "flex min-h-[68px] cursor-pointer flex-col items-stretch gap-1 p-1 text-left tab:min-h-[108px] tab:p-2",
                day === selected ? "bg-brand-soft" : "bg-surface hover:bg-surface-2",
                destino === day && "bg-event-soft",
              )}
              onClick={() => onOpen(day)}
              onDragOver={(event) => {
                event.preventDefault();
                setDestino(day);
              }}
              onDragLeave={() => setDestino((atual) => (atual === day ? null : atual))}
              onDrop={(event) => {
                event.preventDefault();
                setDestino(null);
                const id = event.dataTransfer.getData("text/plain");
                if (id) onMove(id, day);
              }}
              onDoubleClick={() => onOpen(day)}
              onContextMenu={(event) => {
                event.preventDefault();
                onContext(day, event.clientX, event.clientY);
              }}
            >
              <button
                type="button"
                aria-pressed={day === selected}
                aria-label={`${rotuloDoDia(year, month, day)}, ${doDia.length} itens`}
                className={cn(
                  "grid size-6 place-items-center self-start rounded-sm text-sm font-semibold",
                  focusRing,
                  day === today && "bg-brand text-brand-ink!",
                )}
                onClick={() => onSelect(day)}
              >
                {day}
              </button>
              <span className="hidden min-w-0 flex-col gap-0.5 tab:flex">
                {compromissos.slice(0, 3).map((item) => (
                  <div
                    key={`${item.id}-chip`}
                    draggable
                    onDragStart={(event) => {
                      arrastou.current = true;
                      event.dataTransfer.setData("text/plain", item.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDestino(null);
                      window.setTimeout(() => {
                        arrastou.current = false;
                      }, 0);
                    }}
                    className="flex min-w-0 items-center gap-1 rounded-sm bg-event-soft px-1 text-left text-xs leading-snug text-event"
                  >
                    {item.time ? <span className="shrink-0 tabular-nums">{item.time}</span> : null}
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    {item.link ? <span className="font-semibold">R$</span> : null}
                  </div>
                ))}
                {compromissos.length > 3 ? (
                  <button
                    type="button"
                    className={cn("etiqueta text-left text-ink-2 hover:text-ink", focusRing)}
                    onClick={() => onOpen(day)}
                  >
                    +{compromissos.length - 3} mais
                  </button>
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
            </div>
          );
        })}
      </div>
      <p className="mt-3 max-w-prose text-sm text-ink-2">
        Clique no dia para ver os compromissos. Arraste um compromisso para outro dia. “R$” indica uma transação
        vinculada.
      </p>
    </section>
  );
}

function corDoPonto(item: ItemDia) {
  if (item.kind === "compromisso") return "bg-event";
  return item.link && item.link.cents < 0 ? "bg-neg" : "bg-pos";
}

