"use client";

import { useEffect, useState } from "react";
import { NOME_MES, type GeralResposta } from "@finnagent/contracts";
import { Carregando } from "../../components/ui/esqueleto";
import { Vazio } from "../../components/ui/vazio";
import { Money } from "../../components/ui/money";
import { Seta } from "../../components/ui/movimento";
import { Stat } from "../../components/ui/stat";
import { useToast } from "../../components/ui/toast";
import { cn, focusRing } from "../../components/ui/cn";
import { api } from "./api";

export function VisaoGeral({ year, versao }: { year: number; versao: number }) {
  const toast = useToast();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [dados, setDados] = useState<GeralResposta | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let ativo = true;
    api<GeralResposta>(`/api/financas/geral?year=${year}`)
      .then((resposta) => {
        if (!ativo) return;
        setDados(resposta);
        setFalhou(false);
      })
      .catch((error: Error) => {
        if (!ativo) return;
        setFalhou(true);
        toast.erro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, [year, versao, toast]);

  if (!dados) {
    return falhou ? null : (
      <Carregando texto="Carregando a visão geral." titulo linhas={3} />
    );
  }

  const colunas = dados.months;
  if (colunas.length === 0) {
    return (
      <p className="max-w-prose text-sm text-ink-2">
        Esse ano é anterior ao início do workflow.
      </p>
    );
  }

  const grupos = dados.groups;
  const totais = dados.totals;

  return (
    <div className="grid min-w-0 gap-6">
      {grupos.length > 0 ? (
        <dl
          className="flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-4"
          aria-label="Totais do período"
        >
          <Stat label="Entradas">
            <Money cents={totais.inflowsCents} acumulado />
          </Stat>
          <Stat label="Saídas">
            <Money cents={totais.outflowsCents} acumulado />
          </Stat>
          <Stat label="Soma das sobras">
            <Money cents={totais.surplusCents} acumulado />
          </Stat>
        </dl>
      ) : null}
      {grupos.length === 0 ? (
        <Vazio>
          <span className="block max-w-prose">Nenhum lançamento neste ano.</span>
        </Vazio>
      ) : (
      <>
      <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Visão geral por mês</caption>
          <thead>
            <tr>
              <th scope="col" className={cabeca("sticky left-0 z-20 min-w-0 border-r")}>
                Grupo e transação
              </th>
              {colunas.map((month) => (
                <th key={month} scope="col" className={cn(cabeca(), "min-w-0 text-right")}>
                  {NOME_MES[month - 1]}
                </th>
              ))}
              <th scope="col" className={cabeca("sticky right-0 z-20 min-w-0 border-l text-right")}>
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
                      <Seta aberto={aberto} />
                      {grupo.name}
                    </button>
                  </th>
                  {grupo.cents.map((valor, index) => (
                    <td key={colunas[index]} className={numero("bg-surface-2 font-semibold")}>
                      {valor === 0 ? <Traco /> : <Money cents={valor} acumulado />}
                    </td>
                  ))}
                  <td className={total("bg-surface-2")}>
                    <Money cents={grupo.totalCents} acumulado />
                  </td>
                </tr>
                {grupo.entries.map((entry) => (
                    <tr key={entry.id} hidden={!aberto}>
                      <th scope="row" className={fixa("bg-surface pl-8 font-medium")}>
                        <div className="grid gap-1">
                          <div>{entry.sessionName}</div>
                          <div className="text-xs font-normal text-ink-2">{entry.summary}</div>
                        </div>
                      </th>
                      {entry.cents.map((valor, index) => {
                        const month = colunas[index] ?? 1;
                        const fim = valor !== null && entry.endsIn === month;
                        return (
                          <td
                            key={month}
                            className={cn(numero("bg-surface"), fim && "border-r-4 border-r-ink-2")}
                          >
                            {valor === null ? <Traco /> : <Money cents={valor} />}
                          </td>
                        );
                      })}
                      <td className={total("bg-surface")}>
                        <Money cents={entry.totalCents} acumulado />
                      </td>
                    </tr>
                ))}
              </tbody>
            );
          })}
          {grupos.length > 0 ? (
            <tfoot>
              <tr>
                <LinhaRodape
                  rotulo="Sobra do mês"
                  valores={totais.surplus}
                  total={totais.surplusCents}
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
  total: soma,
  destaque = false,
  nota,
}: {
  rotulo: string;
  valores: number[];
  total: number;
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
        <Money cents={soma} acumulado />
        {nota ? <small className="block text-xs font-normal text-ink-2">{nota}</small> : null}
      </td>
    </>
  );
}

function cabeca(extra = "") {
  return cn(
    "border-b border-line bg-surface px-3 py-3 text-left align-top etiqueta whitespace-nowrap text-ink-2",
    extra,
  );
}

function fixa(fundo: string) {
  return cn(
    "sticky left-0 z-10 min-w-0 border-r border-b border-line px-3 py-3 text-left align-top whitespace-nowrap",
    fundo,
  );
}

function numero(fundo: string) {
  return cn(
    "min-w-0 border-b border-line px-3 py-3 text-right align-top whitespace-nowrap",
    fundo,
  );
}

function total(fundo: string) {
  return cn(
    "sticky right-0 z-10 min-w-0 border-b border-l border-line px-3 py-3 text-right align-top font-semibold whitespace-nowrap",
    fundo,
  );
}

function Traco() {
  return <span className="text-ink-2 opacity-60">—</span>;
}
