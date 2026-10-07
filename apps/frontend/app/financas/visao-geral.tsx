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
import { Chip } from "../../components/ui/chip";
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
      <dl
        className="flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-4"
        aria-label="Totais do período"
      >
        <Stat label="Entradas">
          <Money cents={entradas} />
        </Stat>
        <Stat label="Saídas">
          <Money cents={saidas} />
        </Stat>
        <Stat label="Soma das sobras">
          <Money cents={sobra} />
        </Stat>
      </dl>
      <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
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
                <td colSpan={colunas.length + 2} className="px-4 py-6 text-ink-2">
                  Nenhum lançamento neste ano.
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
                      {valor === 0 ? <Traco /> : <Money cents={valor} strong />}
                    </td>
                  ))}
                  <td className={total("bg-surface-2")}>
                    <Money cents={somaDosCentavos(somas)} strong />
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
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.sessionName} <Chip>{entry.type}</Chip>
                          </div>
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
                        <Money cents={somaDosCentavos(valores)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
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
        </table>
      </div>
      <p className="max-w-prose text-sm text-ink-2">
        O Total soma todos os meses em que a transação aparece. A borda à direita marca o
        último mês de parcelas e empréstimos.
      </p>
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
          <Money cents={valor} strong />
        </td>
      ))}
      <td className={cn(total(fundo), "border-b-0")}>
        <Money cents={somaDosCentavos(valores)} strong />
        {nota ? <small className="block text-xs font-normal text-ink-2">{nota}</small> : null}
      </td>
    </>
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
