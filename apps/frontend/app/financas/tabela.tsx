"use client";

import { useState } from "react";
import {
  NOME_MES,
  TIPOS_LANCAMENTO,
  centavosNoMes,
  colunasDoAno,
  indiceDaParcela,
  somaDosCentavos,
  type Lancamento,
  type Workflow,
} from "@finnagent/contracts";
import { Chip } from "../../components/ui/chip";
import { Money } from "../../components/ui/money";
import { focusRing } from "../../components/ui/cn";
import { doisDigitos } from "./reais";

const field = `min-h-10 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;

export function TabelaLancamentos({
  entries,
  workflow,
  year,
}: {
  entries: Lancamento[];
  workflow: Workflow;
  year: number;
}) {
  const colunas = colunasDoAno(workflow, year);
  const [month, setMonth] = useState(9);
  const [groupId, setGroupId] = useState("");
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const monthIndex = colunas.includes(month) ? month : (colunas.at(-1) ?? 0);
  const grupos = gruposDe(entries);
  const busca = query.trim().toLowerCase();
  const linhas = entries
    .filter((entry) => {
      const valor = centavosNoMes(entry, workflow, year, monthIndex);
      if (valor === undefined) return false;
      if (groupId && entry.groupId !== groupId) return false;
      if (type && entry.type !== type) return false;
      if (!busca) return true;
      return `${entry.description} ${entry.justification} ${entry.sessionName}`
        .toLowerCase()
        .includes(busca);
    })
    .sort((a, b) => a.day - b.day);
  const total = somaDosCentavos(
    linhas.map((entry) => centavosNoMes(entry, workflow, year, monthIndex)),
  );

  if (colunas.length === 0) {
    return (
      <p className="max-w-prose text-sm text-ink-2">
        Esse ano é anterior ao início do workflow.
      </p>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Mês"
          value={monthIndex}
          onChange={(event) => setMonth(Number(event.target.value))}
          className={field}
        >
          {colunas.map((coluna) => (
            <option key={coluna} value={coluna}>
              {NOME_MES[coluna]} de {year}
            </option>
          ))}
        </select>
        <select
          aria-label="Grupo"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          className={field}
        >
          <option value="">Todos os grupos</option>
          {grupos.map((grupo) => (
            <option key={grupo.id} value={grupo.id}>
              {grupo.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Tipo"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className={field}
        >
          <option value="">Todos os tipos</option>
          {TIPOS_LANCAMENTO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar descrição ou justificativa"
          aria-label="Buscar"
          className={`${field} min-w-56 flex-1`}
        />
      </div>
      <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Lançamentos do mês</caption>
          <thead>
            <tr>
              {["Data", "Tipo", "Grupo", "Sessão", "Descrição", "Justificativa"].map((coluna) => (
                <th
                  key={coluna}
                  scope="col"
                  className="border-b border-line bg-surface px-3 py-3 text-left align-top font-semibold text-ink-2"
                >
                  {coluna}
                </th>
              ))}
              <th
                scope="col"
                className="border-b border-line bg-surface px-3 py-3 text-right align-top font-semibold whitespace-nowrap text-ink-2"
              >
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-ink-2">
                  Nenhum lançamento com esses filtros.
                </td>
              </tr>
            ) : (
              linhas.map((entry) => {
                const valor = centavosNoMes(entry, workflow, year, monthIndex) ?? 0;
                const parcela = indiceDaParcela(entry, workflow, year, monthIndex, colunas);
                return (
                  <tr key={entry.id}>
                    <td className="border-b border-line px-3 py-3 whitespace-nowrap">
                      <time>
                        {doisDigitos(entry.day)}/{doisDigitos(monthIndex + 1)}
                      </time>
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <Chip>{entry.type}</Chip>
                    </td>
                    <td className="border-b border-line px-3 py-3">{entry.groupName}</td>
                    <td className="border-b border-line px-3 py-3">{entry.sessionName}</td>
                    <td className="border-b border-line px-3 py-3">
                      {entry.description}
                      {parcela ? ` (${parcela}/${entry.installments})` : ""}
                    </td>
                    <td className="border-b border-line px-3 py-3">{entry.justification}</td>
                    <td className="border-b border-line px-3 py-3 text-right whitespace-nowrap">
                      <Money cents={valor} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                colSpan={6}
                className="px-3 py-3 text-left font-semibold"
              >
                Total do mês
              </th>
              <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                <Money cents={total} strong />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function gruposDe(entries: Lancamento[]) {
  const groups: { id: string; name: string }[] = [];
  for (const entry of entries) {
    if (!groups.some((group) => group.id === entry.groupId)) {
      groups.push({ id: entry.groupId, name: entry.groupName });
    }
  }
  return groups;
}
