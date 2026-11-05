import { useState } from "react";
import type { Feriado, StatusCompromisso } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { Icone } from "../../components/ui/icone";
import { caixaDeMarcar, cn, focusRing } from "../../components/ui/cn";
import { List } from "../../components/ui/list";
import { Money } from "../../components/ui/money";
import { ItemAnimado, ListaAnimada } from "../../components/ui/movimento";
import { rotuloDaSituacao, tomDaSituacao } from "../financas/rotulos";
import { feriadosNoDia, LinhaDoFeriado } from "./feriados";
import {
  diaDaSemanaCurto,
  ehHoje,
  itensNoDia,
  rotuloDaCategoria,
  rotuloDoDia,
  rotuloDoStatus,
  type ItemDia,
} from "./itens";

/**
 * A visão em lista do mês: uma lista única, um bloco por dia. O dia fica à esquerda (número grande e o dia da
 * semana), como numa agenda de papel; à direita, os feriados e os itens daquele dia, uma linha cada.
 */
export function ListaMes({
  year,
  month,
  itens,
  feriados,
  onStatus,
  onEdit,
}: {
  year: number;
  month: number;
  itens: ItemDia[];
  feriados: Feriado[];
  onStatus: (id: string, status: StatusCompromisso) => void;
  onEdit: (id: string) => void;
}) {
  const diasComFeriado = feriados.map((item) => Number(item.data.slice(8, 10)));
  const dias = [...new Set([...itens.map((item) => item.day), ...diasComFeriado])].sort((a, b) => a - b);
  if (dias.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-ink-2">
        Nenhum item com os filtros atuais.
      </div>
    );
  }
  return (
    <List>
      {dias.map((day) => {
        const doDia = itensNoDia(itens, day);
        const feriadosDoDia = feriadosNoDia(feriados, day);
        const hoje = ehHoje(year, month, day);
        return (
          <li
            key={day}
            aria-label={rotuloDoDia(year, month, day)}
            className="grid min-w-0 gap-3 border-b border-line px-4 py-4 last:border-b-0 tab:flex tab:gap-6"
          >
            <time
              dateTime={`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`}
              className="flex items-baseline gap-2 tab:w-12 tab:shrink-0 tab:flex-col tab:items-start tab:gap-1"
            >
              <span
                className={cn(
                  "font-display text-xl leading-none font-bold tracking-titulo",
                  hoje ? "text-brand" : "text-ink",
                )}
              >
                {day}
              </span>
              <span className={cn("etiqueta", hoje ? "text-brand" : "text-ink-2")}>{diaDaSemanaCurto(year, month, day)}</span>
              {hoje ? <Chip tone="info">Hoje</Chip> : null}
            </time>
            <ul className="grid min-w-0 flex-1">
              {feriadosDoDia.map((feriado) => (
                <LinhaDoFeriado key={`${feriado.data}-${feriado.nome}`} feriado={feriado} />
              ))}
              {doDia.map((item) => (
                <Linha key={item.id} item={item} onStatus={onStatus} onEdit={onEdit} />
              ))}
            </ul>
          </li>
        );
      })}
    </List>
  );
}

export function resumoDoDia(itens: ItemDia[]) {
  const total = itens.reduce((soma, item) => soma + (item.link?.cents ?? item.acumula?.cents ?? 0), 0);
  return { quantidade: itens.length, total, temValor: itens.some((item) => item.link ?? item.acumula) };
}

export function PainelDoDia({
  itens,
  onStatus,
  onEdit,
  onDelete,
}: {
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
  item,
  onStatus,
  onEdit,
  confirmar,
  onExcluir,
}: {
  item: ItemDia;
  onStatus: (id: string, status: StatusCompromisso) => void;
  onEdit: (id: string) => void;
  confirmar: boolean;
  onExcluir: () => void;
}) {
  const pagamento = item.link?.situation ?? null;
  const meta = metaDoItem(item);
  const proximo = item.status === "done" ? "undone" : "done";
  return (
    <ItemAnimado className="relative border-b border-line py-4 pl-3 last:border-b-0">
      <span className={cn("absolute inset-y-3 left-0 w-1 rounded-sm", faixaDoItem(item))} aria-hidden />
      <div className="flex gap-4">
        <time className="w-16 shrink-0 pt-1 text-xs text-ink-2">{item.time ?? "Dia todo"}</time>
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="min-w-0 truncate font-medium">{item.title}</h3>
            <span className="flex shrink-0 items-center gap-1">
              {item.kind === "compromisso" ? (
                <>
                  <Button
                    type="button"
                    variant="quiet"
                    className="size-10 px-0"
                    aria-label="Editar"
                    onClick={() => onEdit(item.id)}
                  >
                    <Icone name="edit" />
                  </Button>
                  <Button
                    type="button"
                    variant={confirmar ? "danger" : "quiet"}
                    className="size-10 px-0"
                    aria-label={confirmar ? "Confirmar exclusão" : "Excluir"}
                    onClick={onExcluir}
                  >
                    <Icone name="remove" />
                  </Button>
                </>
              ) : null}
              {item.link ? <Money cents={item.link.cents} strong /> : null}
              {!item.link && item.acumula ? <Money cents={item.acumula.cents} strong /> : null}
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
              {item.acumula ? <Chip tone="event">Acumula · {item.acumula.label}</Chip> : null}
              {pagamento ? <Chip tone={tomDaSituacao(pagamento)}>{rotuloDaSituacao(pagamento)}</Chip> : null}
              {item.status ? (
                <Chip tone={item.status === "done" ? "ok" : "default"}>{rotuloDoStatus(item.status)}</Chip>
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
        className={caixaDeMarcar}
      />
      <span className={cn("font-semibold", feito ? "text-brand" : "text-ink-2")}>OK!</span>
    </label>
  );
}

/** A cor do item, a mesma dos pontos da legenda de camadas: índigo é compromisso, verde e vermelho é dinheiro. */
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

/** O que a linha diz em texto, abaixo do título: de onde vem o dinheiro, a agenda, a repetição e o lugar. */
function detalhesDaLinha(item: ItemDia) {
  const partes: string[] = [];
  if (item.link) partes.push(`${item.link.groupName} › ${item.link.sessionName}`);
  if (item.acumula) partes.push(`Acumula ${item.acumula.label}`);
  if (item.calendar) partes.push(item.calendar);
  if (item.category) partes.push(rotuloDaCategoria(item.category));
  if (item.location) partes.push(item.location);
  return partes;
}

export function ListaDoDia({
  itens,
  onStatus,
  onEdit,
}: {
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
    <List className="overflow-hidden px-4">
      {itens.map((item) => (
        <Linha key={item.id} item={item} onStatus={onStatus} onEdit={onEdit} />
      ))}
    </List>
  );
}

/**
 * Uma linha da lista: a hora numa coluna fixa, o ponto colorido e o título, os detalhes em texto embaixo, e o
 * valor com a situação à direita. Só a situação vira chip; o resto é texto, para a linha caber no celular.
 */
function Linha({
  item,
  onStatus,
  onEdit,
}: {
  item: ItemDia;
  onStatus: (id: string, status: StatusCompromisso) => void;
  onEdit: (id: string) => void;
}) {
  const pagamento = item.link?.situation ?? null;
  const proximo = item.status === "done" ? "undone" : "done";
  const detalhes = detalhesDaLinha(item);
  const valor = item.link?.cents ?? item.acumula?.cents ?? null;
  return (
    <li className="flex min-w-0 items-start gap-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
      <time className="w-16 shrink-0 text-sm leading-6 text-ink-2">{item.time ?? "Dia todo"}</time>
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <i className={cn("size-2 shrink-0 rounded-full", faixaDoItem(item))} aria-hidden />
          {item.kind === "compromisso" ? (
            <button
              type="button"
              className={cn("min-w-0 truncate text-left font-medium text-ink hover:text-brand", focusRing)}
              onClick={() => onEdit(item.id)}
            >
              {item.title}
            </button>
          ) : (
            <span className="min-w-0 truncate font-medium">{item.title}</span>
          )}
        </span>
        {detalhes.length > 0 ? <p className="truncate text-sm text-ink-2">{detalhes.join(" · ")}</p> : null}
        {item.description ? <p className="line-clamp-2 text-sm text-ink-2">{item.description}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {valor !== null ? <Money cents={valor} strong /> : null}
        {pagamento ? <Chip tone={tomDaSituacao(pagamento)}>{rotuloDaSituacao(pagamento)}</Chip> : null}
        {item.status ? <OkCompromisso feito={item.status === "done"} onChange={() => onStatus(item.id, proximo)} /> : null}
      </div>
    </li>
  );
}
