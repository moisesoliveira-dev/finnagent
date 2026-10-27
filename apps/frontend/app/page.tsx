"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { type Aviso, type EscopoPainel, type ItemPainel, type PainelResposta } from "@finnagent/contracts";
import { doisDigitos } from "./financas/reais";
import { Barras, type Barra } from "../components/ui/barras";
import { Button } from "../components/ui/button";
import { Contador } from "../components/ui/contador";
import { Carregando } from "../components/ui/esqueleto";
import { Segmentado } from "../components/ui/segmentado";
import { Chip } from "../components/ui/chip";
import Link from "next/link";
import { campo, cn, focusRing } from "../components/ui/cn";
import { Vazio } from "../components/ui/vazio";
import { List } from "../components/ui/list";
import { ListRow } from "../components/ui/list-row";
import { Money } from "../components/ui/money";
import { Cascata, Passo, Troca, useCurva } from "../components/ui/movimento";
import { PageHeader } from "../components/ui/page-header";
import { useToast } from "../components/ui/toast";

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

const field = campo;

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

function diaDaSemana(year: number, month: number, day: number) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(new Date(year, month - 1, day))
    .replace(".", "");
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

function totalDoDia(items: ItemPainel[], dia: number) {
  return items.reduce((soma, item) => (item.day === dia ? soma + (item.cents ?? 0) : soma), 0);
}

export default function Dashboard() {
  const toast = useToast();
  const inicio = hoje();
  const [scope, setScope] = useState<EscopoPainel>("dia");
  const [deslize, setDeslize] = useState(0);
  const [year, setYear] = useState(inicio.year);
  const [month, setMonth] = useState(inicio.month);
  const [day, setDay] = useState(inicio.day);
  const [dados, setDados] = useState<PainelResposta | null>(null);
  const [falha, setFalha] = useState("");
  const pedido = `${scope}:${year}:${month}:${day}`;

  useEffect(() => {
    const params = new URLSearchParams({ scope, year: String(year) });
    if (scope !== "ano") params.set("month", String(month));
    if (scope === "dia") params.set("day", String(day));
    let ativo = true;
    api<PainelResposta>(`/api/painel?${params.toString()}`)
      .then((resposta) => {
        if (!ativo) return;
        setDados(resposta);
        setFalha("");
      })
      .catch((error: Error) => {
        if (!ativo) return;
        setFalha(pedido);
        toast.erro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, [pedido, scope, year, month, day, toast]);

  function ir(proximo: { year: number; month: number; day: number }, delta = 0) {
    setDeslize(delta > 0 ? 1 : delta < 0 ? -1 : 0);
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
  const aguardando = !painel && falha !== pedido;
  const dias = [...new Set(painel?.items.map((item) => item.day) ?? [])].sort((a, b) => a - b);

  // Gráfico: o ano mostra a sobra de cada mês e o mês mostra o saldo de cada dia. O dia não tem gráfico.
  const barrasDoAno: Barra[] =
    painel?.scope === "ano"
      ? painel.months.map((mes) => ({
          id: String(mes.month),
          curto: MESES[mes.month - 1].slice(0, 3),
          rotulo: `${MESES[mes.month - 1]} de ${year}`,
          cents: mes.sobra,
        }))
      : [];
  const ultimoDia = new Date(year, month, 0).getDate();
  const barrasDoMes: Barra[] =
    painel?.scope === "mes" && dias.length > 0
      ? Array.from({ length: ultimoDia }, (_, indice) => {
          const dia = indice + 1;
          return {
            id: String(dia),
            curto: dia === 1 || dia % 5 === 0 ? String(dia) : "",
            rotulo: rotulo(year, month, dia).replace(/^Hoje, /, ""),
            cents: totalDoDia(painel.items, dia),
          };
        })
      : [];

  return (
    <>
      <PageHeader title="Dashboard" subtitle={periodo} />
      <div className="mb-6 flex flex-wrap items-center gap-3 border border-line bg-surface p-3">
        <Segmentado
          aria-label="Período"
          opcoes={ESCOPOS}
          valor={scope}
          onEscolher={(id, direcao) => {
            setDeslize(direcao);
            setScope(id);
          }}
        />
        <div className="flex items-center gap-1 font-semibold">
          <Button
            variant="quiet"
            className="size-10 px-0"
            aria-label="Período anterior"
            disabled={aguardando}
            onClick={() => ir(mover(scope, year, month, day, -1), -1)}
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
                  const antes = year * 10000 + month * 100 + day;
                  const depois = proximoAno * 10000 + proximoMes * 100 + proximoDia;
                  ir({ year: proximoAno, month: proximoMes, day: proximoDia }, depois - antes);
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
            disabled={aguardando}
            onClick={() => ir(mover(scope, year, month, day, 1), 1)}
          >
            ›
          </Button>
        </div>
        <Button
          variant="quiet"
          className="tab:ml-auto"
          disabled={noPeriodoAtual}
          onClick={() => {
            const antes = year * 10000 + month * 100 + day;
            const depois = atual.year * 10000 + atual.month * 100 + atual.day;
            ir(atual, depois - antes);
          }}
        >
          {voltar}
        </Button>
      </div>

      <Troca id={`${scope}-${year}-${month}-${day}`} direcao={deslize} className="min-w-0">
        {aguardando ? <Carregando texto="Carregando o dashboard." titulo linhas={4} /> : null}

        {painel ? (
          <Cascata className="grid min-w-0 gap-8">
            <Passo className="grid min-w-0 gap-px border border-line bg-line desk:grid-cols-5">
              <div className="grid content-between gap-6 bg-surface p-6 desk:col-span-2">
                <div className="grid gap-2">
                  <span className="etiqueta text-ink-2">Sobra do período</span>
                  <span className="font-display text-2xl font-bold tracking-titulo">
                    <Contador cents={painel.sobra} />
                  </span>
                </div>
                <FluxoDoDinheiro entradas={painel.entradas} saidas={painel.saidas} />
              </div>
              <dl className="grid grid-cols-2 gap-px bg-line desk:col-span-3" aria-label="Totais do período">
                <Indicador rotulo="Entradas">
                  <Contador cents={painel.entradas} />
                </Indicador>
                <Indicador rotulo="Saídas">
                  <Contador cents={painel.saidas} />
                </Indicador>
                <Indicador rotulo="Compromissos">{painel.compromissos}</Indicador>
                <Indicador rotulo="Lançamentos">{painel.lancamentos}</Indicador>
              </dl>
            </Passo>

            {painel.semConferir > 0 ? (
              <Passo>
                <p
                  role="status"
                  className="flex flex-wrap items-center justify-between gap-3 border border-pending-line bg-pending-soft px-4 py-3 text-sm text-pending"
                >
                  <span>
                    {painel.semConferir === 1
                      ? "1 linha do extrato ainda não entrou nestes totais."
                      : `${painel.semConferir} linhas do extrato ainda não entraram nestes totais.`}{" "}
                    Cada uma precisa de um lançamento ou de uma sessão.
                  </span>
                  <Link
                    href="/extratos/conferencia"
                    className={cn("font-medium underline underline-offset-4", focusRing)}
                  >
                    Conferir agora
                  </Link>
                </p>
              </Passo>
            ) : null}

            {painel.avisos.length > 0 ? (
              <Passo>
                <section className="grid min-w-0 gap-3" aria-label="Avisos">
                  <h2 className="font-display text-lg">Avisos</h2>
                  <List animada>
                    {painel.avisos.map((aviso) => (
                      <LinhaAviso key={aviso.id} aviso={aviso} />
                    ))}
                  </List>
                </section>
              </Passo>
            ) : null}

            {painel.scope === "ano" ? (
              <>
                <Passo>
                  <section className="grid min-w-0 gap-3" aria-label="Sobra por mês">
                    <h2 className="font-display text-lg">Sobra por mês</h2>
                    <Barras
                      barras={barrasDoAno}
                      ativo={year === atual.year ? String(atual.month) : undefined}
                      ariaLabel="Sobra de cada mês do ano"
                      onEscolher={(id) => {
                        setScope("mes");
                        ir({ year, month: Number(id), day: 1 }, -1);
                      }}
                    />
                  </section>
                </Passo>
                <Passo>
                  <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
                    <table className="w-full border-separate border-spacing-0 text-sm">
                      <caption className="sr-only">Meses do ano</caption>
                      <thead>
                        <tr>
                          <th className="border-b border-line px-4 py-3 text-left etiqueta text-ink-2">Mês</th>
                          <th className="border-b border-line px-4 py-3 text-right etiqueta text-ink-2">Sobra</th>
                          <th className="border-b border-line px-4 py-3 text-right etiqueta text-ink-2">
                            Compromissos
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {painel.months.map((mes) => (
                          <tr key={mes.month} className="last:*:border-b-0">
                            <th className="border-b border-line p-0 text-left font-medium" scope="row">
                              <Button
                                variant="link"
                                className="w-full justify-start px-4"
                                onClick={() => {
                                  setScope("mes");
                                  ir({ year, month: mes.month, day: 1 }, -1);
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
                </Passo>
              </>
            ) : dias.length === 0 ? (
              <Passo>
                <Vazio>{painel.scope === "dia" ? "Nada neste dia." : "Nada neste mês."}</Vazio>
              </Passo>
            ) : (
              <>
                {painel.scope === "mes" ? (
                  <Passo>
                    <section className="grid min-w-0 gap-3" aria-label="Saldo por dia">
                      <h2 className="font-display text-lg">Saldo por dia</h2>
                      <Barras
                        barras={barrasDoMes}
                        ativo={year === atual.year && month === atual.month ? String(atual.day) : undefined}
                        ariaLabel="Saldo de cada dia do mês"
                        onEscolher={(id) => {
                          setScope("dia");
                          ir({ year, month, day: Number(id) }, -1);
                        }}
                      />
                    </section>
                  </Passo>
                ) : null}
                {dias.map((dia) => (
                  <Passo key={dia}>
                    <section
                      className={cn("flex min-w-0 flex-col gap-3", painel.scope === "mes" && "tab:flex-row tab:gap-6")}
                    >
                      {painel.scope === "mes" ? (
                        <header className="flex items-baseline gap-3 tab:sticky tab:top-12 tab:w-12 tab:shrink-0 tab:flex-col tab:gap-1 tab:self-start">
                          <Button
                            variant="link"
                            className="min-h-0 justify-start font-display text-xl font-bold tracking-titulo"
                            aria-label={`Abrir ${rotulo(year, month, dia).replace(/^Hoje, /, "")}`}
                            onClick={() => {
                              setScope("dia");
                              ir({ year, month, day: dia }, -1);
                            }}
                          >
                            {doisDigitos(dia)}
                          </Button>
                          <span className="etiqueta text-ink-2">{diaDaSemana(year, month, dia)}</span>
                          {year === atual.year && month === atual.month && dia === atual.day ? (
                            <Chip tone="ok">Hoje</Chip>
                          ) : null}
                          <span className="ml-auto tab:hidden">
                            <Money cents={totalDoDia(painel.items, dia)} />
                          </span>
                        </header>
                      ) : null}
                      <List animada className="min-w-0 flex-1 overflow-hidden">
                        {painel.items
                          .filter((item) => item.day === dia)
                          .map((item) => (
                            <Linha key={item.id} item={item} />
                          ))}
                      </List>
                    </section>
                  </Passo>
                ))}
              </>
            )}
          </Cascata>
        ) : null}
      </Troca>
    </>
  );
}

function Indicador({ rotulo: nome, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid content-between gap-2 bg-surface p-4">
      <dt className="etiqueta text-ink-2">{nome}</dt>
      <dd className="font-display text-lg font-bold tracking-titulo">{children}</dd>
    </div>
  );
}

// Entradas e saídas lado a lado numa barra só: a parte verde é o que entrou, a vermelha é o que saiu.
function FluxoDoDinheiro({ entradas, saidas }: { entradas: number; saidas: number }) {
  const curva = useCurva();
  const saiu = Math.abs(saidas);
  const total = entradas + saiu;
  if (total === 0) return <p className="text-sm text-ink-2">Sem movimento neste período.</p>;
  const parteEntrada = Math.round((entradas / total) * 100);
  return (
    <div className="grid gap-2">
      <div className="flex h-1 w-full overflow-hidden bg-line">
        <motion.div
          className="h-full origin-left bg-pos"
          style={{ width: `${parteEntrada}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ ...curva, duration: 0.8 }}
        />
        <motion.div
          className="h-full origin-right bg-neg"
          style={{ width: `${100 - parteEntrada}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ ...curva, duration: 0.8 }}
        />
      </div>
      <p className="etiqueta text-ink-2">
        {entradas > 0 ? `${Math.round((saiu / entradas) * 100)}% das entradas viram saída` : "Só saídas neste período"}
      </p>
    </div>
  );
}

function LinhaAviso({ aviso }: { aviso: Aviso }) {
  return (
    <ListRow
      animado
      kind={aviso.kind === "lembrete" ? "event" : "transaction"}
      title={aviso.title}
      meta={aviso.kind === "lembrete" ? "Lembrete" : "Vence hoje"}
      value={null}
    />
  );
}

function Linha({ item }: { item: ItemPainel }) {
  return (
    <ListRow
      animado
      kind={item.kind === "compromisso" ? "event" : "transaction"}
      time={item.time ?? undefined}
      title={item.title}
      meta={item.detail}
      value={item.cents === null ? <span className="text-sm text-ink-2">Compromisso</span> : <Money cents={item.cents} strong />}
    />
  );
}
