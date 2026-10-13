"use client";

import { useState } from "react";
import {
  NOME_MES,
  centavosNoMes,
  colunasDoAno,
  encerraNoMes,
  somaDosCentavos,
  textoDaLinha,
  totaisDoMes,
  type Lancamento,
  type Workflow,
} from "@finnagent/contracts";
import { List } from "../../components/ui/list";
import { Money } from "../../components/ui/money";
import { Stat } from "../../components/ui/stat";
import { cn, focusRing } from "../../components/ui/cn";

export function VisaoGeral({
  entries,
  workflow,
  year,
}: {
  entries: Lancamento[];
  workflow: Workflow;
  year: number;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const colunas = colunasDoAno(workflow, year);
  if (colunas.length === 0) {
    return (
      <p className="max-w-prose text-sm text-ink-2">
        Esse ano é anterior ao início do workflow.
      </p>
    );
  }

  const grupos = agrupar(
    entries.filter((entry) =>
      colunas.some((month) => centavosNoMes(entry, workflow, year, month) !== undefined),
    ),
  );
  const porMes = colunas.map((month) => totaisDoMes(entries, workflow, year, month));
  const entradas = porMes.reduce((total, mes) => total + mes.entradas, 0);
  const saidas = porMes.reduce((total, mes) => total + mes.saidas, 0);
  const sobra = entradas + saidas;

  return (
    <div className="grid min-w-0 gap-6">
      {grupos.length > 0 ? (
        <dl
          className="flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-4"
          aria-label="Totais do período"
        >
          <Stat label="Entradas">
            <Money cents={entradas} acumulado />
          </Stat>
          <Stat label="Saídas">
            <Money cents={saidas} acumulado />
          </Stat>
          <Stat label="Soma das sobras">
            <Money cents={sobra} acumulado />
          </Stat>
        </dl>
      ) : null}
      {grupos.length === 0 ? (
        <p className="min-w-0 rounded-lg border border-line bg-surface px-4 py-6 text-sm text-ink-2">
          <span className="block max-w-prose">Nenhum lançamento neste ano.</span>
        </p>
      ) : (
      <>
      <div className="grid min-w-0 gap-4 tab:hidden">
        {grupos.map((grupo) => {
          const aberto = !closed[grupo.id];
          const somas = colunas.map((month) =>
            somaDosCentavos(
              grupo.entries.map((entry) => centavosNoMes(entry, workflow, year, month)),
            ),
          );
          return (
            <section key={grupo.id} className="min-w-0 rounded-lg border border-line bg-surface">
              <h2 className="rounded-t-lg bg-surface-2">
                <button
                  type="button"
                  className={`relative z-10 flex min-h-10 w-full min-w-0 items-center gap-3 bg-transparent px-4 py-3 text-left font-semibold ${focusRing}`}
                  aria-expanded={aberto}
                  onClick={() => setClosed((current) => ({ ...current, [grupo.id]: aberto }))}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 border-r-2 border-b-2 border-ink-2 transition-transform duration-150 motion-reduce:transition-none",
                      aberto ? "rotate-45" : "-rotate-45",
                    )}
                  />
                  <span className="min-w-0 flex-1 wrap-break-word">{grupo.name}</span>
                  <span className="shrink-0 font-sans leading-normal tracking-normal">
                    <Money cents={somaDosCentavos(somas)} acumulado />
                  </span>
                </button>
              </h2>
              <dl
                className={cn(
                  "grid min-w-0 gap-2 border-t border-line bg-surface-2 px-4 py-3",
                  !aberto && "rounded-b-lg",
                )}
              >
                {somas.map((valor, index) => {
                  const month = colunas[index] ?? 0;
                  return (
                    <LinhaMes
                      key={month}
                      mes={NOME_MES[month] ?? ""}
                      valor={valor}
                      traco={valor === 0}
                      acumulado
                    />
                  );
                })}
              </dl>
              {aberto ? (
                <ul className="min-w-0">
                  {grupo.entries.map((entry) => {
                    const valores = colunas.map((month) => centavosNoMes(entry, workflow, year, month));
                    return (
                      <li key={entry.id} className="grid min-w-0 gap-3 border-t border-line px-4 py-3">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium wrap-break-word">{entry.sessionName}</div>
                            <div className="max-w-prose text-xs wrap-break-word text-ink-2">{textoDaLinha(entry)}</div>
                          </div>
                          <span className="shrink-0">
                            <Money cents={somaDosCentavos(valores)} acumulado />
                          </span>
                        </div>
                        <dl className="grid min-w-0 gap-2">
                          {valores.map((valor, index) => {
                            if (valor === undefined) return null;
                            const month = colunas[index] ?? 0;
                            return (
                              <LinhaMes
                                key={month}
                                mes={NOME_MES[month] ?? ""}
                                valor={valor}
                                fim={encerraNoMes(entry, year, month)}
                              />
                            );
                          })}
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
      <TotaisNoCelular colunas={colunas} porMes={porMes} />
      <div className="hidden min-w-0 overflow-x-auto rounded-lg border border-line bg-surface tab:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Visão geral por mês</caption>
          <thead>
            <tr>
              <th scope="col" className={cabeca("sticky left-0 z-20 min-w-64 border-r")}>
                Grupo e transação
              </th>
              {colunas.map((month) => (
                <th key={month} scope="col" className={cn(cabeca(), "min-w-28 text-right")}>
                  {NOME_MES[month]}
                </th>
              ))}
              <th scope="col" className={cabeca("sticky right-0 z-20 min-w-28 border-l text-right")}>
                Total
              </th>
            </tr>
          </thead>
          {grupos.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={colunas.length + 2} className="px-4 py-12">
                  <p className="sticky left-1/2 w-max -translate-x-1/2 text-center text-ink-2">
                    Nenhum lançamento neste ano.
                  </p>
                </td>
              </tr>
            </tbody>
          ) : null}
          {grupos.map((grupo) => {
            const aberto = !closed[grupo.id];
            const somas = colunas.map((month) =>
              somaDosCentavos(
                grupo.entries.map((entry) => centavosNoMes(entry, workflow, year, month)),
              ),
            );
            return (
              <tbody key={grupo.id}>
                <tr>
                  <th scope="row" className={fixa("bg-surface-2 font-semibold")}>
                    <button
                      type="button"
                      className={`flex min-h-10 items-center gap-3 bg-transparent text-left font-semibold ${focusRing}`}
                      aria-expanded={aberto}
                      onClick={() =>
                        setClosed((current) => ({ ...current, [grupo.id]: aberto }))
                      }
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 border-r-2 border-b-2 border-ink-2 transition-transform duration-150 motion-reduce:transition-none",
                          aberto ? "rotate-45" : "-rotate-45",
                        )}
                      />
                      {grupo.name}
                    </button>
                  </th>
                  {somas.map((valor, index) => (
                    <td key={colunas[index]} className={numero("bg-surface-2 font-semibold")}>
                      {valor === 0 ? <Traco /> : <Money cents={valor} acumulado />}
                    </td>
                  ))}
                  <td className={total("bg-surface-2")}>
                    <Money cents={somaDosCentavos(somas)} acumulado />
                  </td>
                </tr>
                {grupo.entries.map((entry) => {
                  const valores = colunas.map((month) =>
                    centavosNoMes(entry, workflow, year, month),
                  );
                  return (
                    <tr key={entry.id} hidden={!aberto}>
                      <th scope="row" className={fixa("bg-surface pl-8 font-medium")}>
                        <div className="grid gap-1">
                          <div>{entry.sessionName}</div>
                          <div className="text-xs font-normal text-ink-2">{textoDaLinha(entry)}</div>
                        </div>
                      </th>
                      {valores.map((valor, index) => {
                        const month = colunas[index] ?? 0;
                        const fim =
                          valor !== undefined && encerraNoMes(entry, year, month);
                        return (
                          <td
                            key={month}
                            className={cn(numero("bg-surface"), fim && "border-r-4 border-r-ink-2")}
                          >
                            {valor === undefined ? <Traco /> : <Money cents={valor} />}
                          </td>
                        );
                      })}
                      <td className={total("bg-surface")}>
                        <Money cents={somaDosCentavos(valores)} acumulado />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
          {grupos.length > 0 ? (
            <tfoot>
              <tr>
                <LinhaRodape rotulo="Entradas" valores={porMes.map((mes) => mes.entradas)} />
              </tr>
              <tr>
                <LinhaRodape rotulo="Saídas" valores={porMes.map((mes) => mes.saidas)} />
              </tr>
              <tr>
                <LinhaRodape
                  rotulo="Sobra do mês"
                  valores={porMes.map((mes) => mes.sobra)}
                  destaque
                  nota="soma das sobras"
                />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      </>
      )}
      {grupos.length > 0 ? (
        <p className="max-w-prose text-sm text-ink-2">
          O Total soma todos os meses em que a transação aparece. A borda marca o último mês de
          parcelas e empréstimos.
        </p>
      ) : null}
    </div>
  );
}

function LinhaRodape({
  rotulo,
  valores,
  destaque = false,
  nota,
}: {
  rotulo: string;
  valores: number[];
  destaque?: boolean;
  nota?: string;
}) {
  const fundo = destaque ? "bg-brand-soft" : "bg-surface";
  return (
    <>
      <th scope="row" className={cn(fixa(fundo), "border-b-0 font-semibold")}>
        {rotulo}
      </th>
      {valores.map((valor, index) => (
        <td key={index} className={cn(numero(fundo), "border-b-0 font-semibold")}>
          <Money cents={valor} acumulado />
        </td>
      ))}
      <td className={cn(total(fundo), "border-b-0")}>
        <Money cents={somaDosCentavos(valores)} acumulado />
        {nota ? <small className="block text-xs font-normal text-ink-2">{nota}</small> : null}
      </td>
    </>
  );
}

function LinhaMes({
  mes,
  valor,
  fim = false,
  traco = false,
  acumulado = false,
}: {
  mes: string;
  valor: number | undefined;
  fim?: boolean;
  traco?: boolean;
  acumulado?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-3",
        fim && "border-l-4 border-ink-2 pl-3",
      )}
    >
      <dt className="min-w-0 text-sm text-ink-2">{mes}</dt>
      <dd className="shrink-0">
        {traco || valor === undefined ? <Traco /> : <Money cents={valor} acumulado={acumulado} />}
      </dd>
    </div>
  );
}

function TotaisNoCelular({
  colunas,
  porMes,
}: {
  colunas: number[];
  porMes: { entradas: number; saidas: number; sobra: number }[];
}) {
  const linhas: { rotulo: string; valores: number[]; destaque?: boolean; nota?: string }[] = [
    { rotulo: "Entradas", valores: porMes.map((mes) => mes.entradas) },
    { rotulo: "Saídas", valores: porMes.map((mes) => mes.saidas) },
    {
      rotulo: "Sobra do mês",
      valores: porMes.map((mes) => mes.sobra),
      destaque: true,
      nota: "soma das sobras",
    },
  ];

  return (
    <section className="grid min-w-0 gap-3 tab:hidden" aria-labelledby="totais-por-mes">
      <h2 id="totais-por-mes" className="min-w-0 font-display text-lg">
        Totais por mês
      </h2>
      <div className="min-w-0">
        <List>
          {linhas.map((linha) => (
            <li
              key={linha.rotulo}
              className={cn(
                "grid min-w-0 gap-3 border-b border-line px-4 py-3 last:border-b-0",
                linha.destaque && "bg-brand-soft",
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <span className="min-w-0 font-semibold">{linha.rotulo}</span>
                <span className="shrink-0 text-right">
                  <Money cents={somaDosCentavos(linha.valores)} acumulado />
                  {linha.nota ? (
                    <small className="block max-w-prose text-xs font-normal text-ink-2">{linha.nota}</small>
                  ) : null}
                </span>
              </div>
              <dl className="grid min-w-0 gap-2">
                {linha.valores.map((valor, index) => {
                  const month = colunas[index] ?? 0;
                  return (
                    <LinhaMes
                      key={month}
                      mes={NOME_MES[month] ?? ""}
                      valor={valor}
                      acumulado
                    />
                  );
                })}
              </dl>
            </li>
          ))}
        </List>
      </div>
    </section>
  );
}

function agrupar(entries: Lancamento[]) {
  const groups: { id: string; name: string; entries: Lancamento[] }[] = [];
  for (const entry of entries) {
    const current = groups.find((group) => group.id === entry.groupId);
    if (current) current.entries.push(entry);
    else groups.push({ id: entry.groupId, name: entry.groupName, entries: [entry] });
  }
  return groups;
}

function cabeca(extra = "") {
  return cn(
    "border-b border-line bg-surface px-3 py-3 text-left align-top font-semibold whitespace-nowrap text-ink-2",
    extra,
  );
}

function fixa(fundo: string) {
  return cn(
    "sticky left-0 z-10 min-w-64 border-r border-b border-line px-3 py-3 text-left align-top whitespace-nowrap",
    fundo,
  );
}

function numero(fundo: string) {
  return cn(
    "min-w-28 border-b border-line px-3 py-3 text-right align-top whitespace-nowrap",
    fundo,
  );
}

function total(fundo: string) {
  return cn(
    "sticky right-0 z-10 min-w-28 border-b border-l border-line px-3 py-3 text-right align-top font-semibold whitespace-nowrap",
    fundo,
  );
}

function Traco() {
  return <span className="text-ink-2 opacity-60">—</span>;
}
