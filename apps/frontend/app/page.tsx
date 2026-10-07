"use client";

import { useEffect, useState } from "react";
import { type EscopoPainel, type ItemPainel, type PainelResposta } from "@finnagent/contracts";
import { doisDigitos } from "./financas/reais";
import { Button } from "../components/ui/button";
import { Chip } from "../components/ui/chip";
import { cn, focusRing } from "../components/ui/cn";
import { List } from "../components/ui/list";
import { ListRow } from "../components/ui/list-row";
import { Money } from "../components/ui/money";
import { PageHeader } from "../components/ui/page-header";
import { Stat } from "../components/ui/stat";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const ESCOPOS: { id: EscopoPainel; label: string }[] = [
  { id: "dia", label: "Data" },
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
];

const field = `min-h-10 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;

function hoje() {
  const data = new Date();
  return { year: data.getFullYear(), month: data.getMonth() + 1, day: data.getDate() };
}

function rotulo(year: number, month: number, day: number) {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day));
  const frase = texto.charAt(0).toUpperCase() + texto.slice(1);
  const atual = hoje();
  if (year === atual.year && month === atual.month && day === atual.day) return `Hoje, ${frase}`;
  return frase;
}

function mover(scope: EscopoPainel, year: number, month: number, day: number, delta: number) {
  if (scope === "ano") return { year: year + delta, month, day };
  if (scope === "mes") {
    const data = new Date(year, month - 1 + delta, 1);
    return { year: data.getFullYear(), month: data.getMonth() + 1, day: 1 };
  }
  const data = new Date(year, month - 1, day + delta);
  return { year: data.getFullYear(), month: data.getMonth() + 1, day: data.getDate() };
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { "content-type": "application/json" } });
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(message || "O backend não respondeu.");
  }
  return body as T;
}

function contagem(painel: PainelResposta) {
  const compromissos = painel.compromissos === 1 ? "1 compromisso" : `${painel.compromissos} compromissos`;
  const lancamentos = painel.lancamentos === 1 ? "1 lançamento" : `${painel.lancamentos} lançamentos`;
  return `${compromissos} · ${lancamentos}`;
}

function mesmoPeriodo(
  painel: PainelResposta,
  scope: EscopoPainel,
  year: number,
  month: number,
  day: number,
) {
  if (painel.scope !== scope || painel.year !== year) return false;
  if (scope === "ano") return true;
  if (painel.month !== month) return false;
  return scope === "mes" || painel.day === day;
}

export default function Dashboard() {
  const inicio = hoje();
  const [scope, setScope] = useState<EscopoPainel>("dia");
  const [year, setYear] = useState(inicio.year);
  const [month, setMonth] = useState(inicio.month);
  const [day, setDay] = useState(inicio.day);
  const [dados, setDados] = useState<PainelResposta | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ scope, year: String(year) });
    if (scope !== "ano") params.set("month", String(month));
    if (scope === "dia") params.set("day", String(day));
    let ativo = true;
    setCarregando(true);
    setErro("");
    api<PainelResposta>(`/api/painel?${params.toString()}`)
      .then((resposta) => {
        if (ativo) setDados(resposta);
      })
      .catch((error: Error) => {
        if (ativo) setErro(error.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [scope, year, month, day]);

  function ir(proximo: { year: number; month: number; day: number }) {
    setYear(proximo.year);
    setMonth(proximo.month);
    setDay(proximo.day);
  }

  const atual = hoje();
  const noPeriodoAtual =
    scope === "ano"
      ? year === atual.year
      : scope === "mes"
        ? year === atual.year && month === atual.month
        : year === atual.year && month === atual.month && day === atual.day;
  const voltar = scope === "ano" ? "Este ano" : scope === "mes" ? "Este mês" : "Hoje";
  const periodo =
    scope === "ano" ? String(year) : scope === "mes" ? `${MESES[month - 1]} de ${year}` : rotulo(year, month, day);
  const painel = dados && mesmoPeriodo(dados, scope, year, month, day) ? dados : null;
  const dias = [...new Set(painel?.items.map((item) => item.day) ?? [])].sort((a, b) => a - b);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={periodo} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-sm border border-line bg-surface"
          role="group"
          aria-label="Período"
        >
          {ESCOPOS.map((item, index) => (
            <Button
              key={item.id}
              variant="quiet"
              aria-pressed={scope === item.id}
              className={cn(
                "rounded-none border-0",
                index === 0 && "rounded-l-sm",
                index === ESCOPOS.length - 1 && "rounded-r-sm",
                scope === item.id && "bg-brand-soft text-brand!",
              )}
              onClick={() => setScope(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1 font-semibold">
          <Button
            variant="quiet"
            className="size-10 px-0"
            aria-label="Período anterior"
            disabled={carregando}
            onClick={() => ir(mover(scope, year, month, day, -1))}
          >
            ‹
          </Button>
          {scope === "dia" ? (
            <input
              type="date"
              className={field}
              aria-label="Data"
              value={`${year}-${doisDigitos(month)}-${doisDigitos(day)}`}
              onChange={(event) => {
                const [proximoAno, proximoMes, proximoDia] = event.target.value.split("-").map(Number);
                if (proximoAno && proximoMes && proximoDia) {
                  ir({ year: proximoAno, month: proximoMes, day: proximoDia });
                }
              }}
            />
          ) : (
            <span>{scope === "ano" ? year : `${MESES[month - 1]} ${year}`}</span>
          )}
          <Button
            variant="quiet"
            className="size-10 px-0"
            aria-label="Próximo período"
            disabled={carregando}
            onClick={() => ir(mover(scope, year, month, day, 1))}
          >
            ›
          </Button>
        </div>
        <Button variant="quiet" disabled={noPeriodoAtual} onClick={() => {
          setScope(scope);
          ir(atual);
        }}>
          {voltar}
        </Button>
      </div>

      {erro ? (
        <p role="alert" className="mb-4 max-w-prose text-sm text-neg">
          {erro}
        </p>
      ) : null}
      {!painel && carregando ? (
        <p role="status" className="max-w-prose text-sm text-ink-2">
          Carregando o dashboard.
        </p>
      ) : null}

      {painel ? (
        <div className="grid min-w-0 gap-8">
          <dl className="flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-4" aria-label="Totais do período">
            <Stat label="Entradas">
              <Money cents={painel.entradas} strong />
            </Stat>
            <Stat label="Saídas">
              <Money cents={painel.saidas} strong />
            </Stat>
            <Stat label="Sobra">
              <Money cents={painel.sobra} strong />
            </Stat>
          </dl>
          <p className="text-sm text-ink-2">{contagem(painel)}</p>

          {painel.scope === "ano" ? (
            <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <caption className="sr-only">Meses do ano</caption>
                <thead>
                  <tr>
                    <th className="border-b border-line px-4 py-3 text-left font-semibold text-ink-2">Mês</th>
                    <th className="border-b border-line px-4 py-3 text-right font-semibold text-ink-2">Sobra</th>
                    <th className="border-b border-line px-4 py-3 text-right font-semibold text-ink-2">
                      Compromissos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {painel.months.map((mes) => (
                    <tr key={mes.month} className="last:[&>*]:border-b-0">
                      <th className="border-b border-line p-0 text-left font-medium" scope="row">
                        <Button
                          variant="quiet"
                          className="w-full justify-start rounded-none px-4 text-brand!"
                          onClick={() => {
                            setScope("mes");
                            ir({ year, month: mes.month, day: 1 });
                          }}
                        >
                          {MESES[mes.month - 1]}
                        </Button>
                      </th>
                      <td className="border-b border-line px-4 py-3 text-right whitespace-nowrap">
                        <Money cents={mes.sobra} strong />
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right">{mes.compromissos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : dias.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-2">
              {painel.scope === "dia" ? "Nada neste dia." : "Nada neste mês."}
            </p>
          ) : (
            dias.map((dia) => (
              <section key={dia} className="grid min-w-0 gap-3">
                {painel.scope === "mes" ? (
                  <h2 className="flex flex-wrap items-center gap-2 font-display text-lg">
                    <Button
                      variant="quiet"
                      className="h-auto justify-start px-0 font-display text-lg font-bold text-brand!"
                      onClick={() => {
                        setScope("dia");
                        ir({ year, month, day: dia });
                      }}
                    >
                      {rotulo(year, month, dia).replace(/^Hoje, /, "")}
                    </Button>
                    {year === atual.year && month === atual.month && dia === atual.day ? (
                      <Chip tone="ok" className="font-sans font-normal">
                        Hoje
                      </Chip>
                    ) : null}
                  </h2>
                ) : null}
                <List>
                  {painel.items.filter((item) => item.day === dia).map((item) => (
                    <Linha key={item.id} item={item} />
                  ))}
                </List>
              </section>
            ))
          )}
        </div>
      ) : null}
    </>
  );
}

function Linha({ item }: { item: ItemPainel }) {
  return (
    <ListRow
      kind={item.kind === "compromisso" ? "event" : "transaction"}
      time={item.time ?? undefined}
      title={item.title}
      meta={item.detail}
      value={item.cents === null ? <span className="text-sm text-ink-2">Compromisso</span> : <Money cents={item.cents} strong />}
    />
  );
}
