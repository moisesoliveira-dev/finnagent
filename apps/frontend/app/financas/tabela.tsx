"use client";

import { useState } from "react";
import {
  CATEGORIAS_TRANSACAO,
  NOME_MES,
  centavosNoMes,
  colunasDoAno,
  indiceDaParcela,
  ocorreNoMes,
  somaDosCentavos,
  type Lancamento,
  type Workflow,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { Money } from "../../components/ui/money";
import { focusRing } from "../../components/ui/cn";
import { doisDigitos } from "./reais";
import { ROTULO_CATEGORIA, ROTULO_STATUS } from "./rotulos";

const field = `min-h-10 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;

export function TabelaLancamentos({
  entries,
  workflow,
  year,
  onEditar,
}: {
  entries: Lancamento[];
  workflow: Workflow;
  year: number;
  onEditar: (entry: Lancamento) => void;
}) {
  const colunas = colunasDoAno(workflow, year);
  const [month, setMonth] = useState(9);
  const [groupId, setGroupId] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const monthIndex = colunas.includes(month) ? month : (colunas.at(-1) ?? 0);
  const grupos = gruposDe(entries);
  const busca = query.trim().toLowerCase();
  const linhas = entries
    .filter((entry) => {
      if (!ocorreNoMes(entry, workflow, year, monthIndex)) return false;
      if (groupId && entry.groupId !== groupId) return false;
      if (category && entry.category !== category) return false;
      if (!busca) return true;
      return `${entry.name} ${entry.description} ${entry.justification} ${entry.sessionName}`
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
          aria-label="Categoria"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={field}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS_TRANSACAO.map((item) => (
            <option key={item} value={item}>
              {ROTULO_CATEGORIA[item]}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nome, descrição ou justificativa"
          aria-label="Buscar"
          className={`${field} min-w-56 flex-1`}
        />
      </div>
      <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Lançamentos do mês</caption>
          <thead>
            <tr>
              {["Data", "Nome", "Categoria", "Status", "Grupo", "Sessão", "Descrição", "Justificativa"].map((coluna) => (
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
              <th scope="col" className="border-b border-line bg-surface px-3 py-3 text-right">
                <span className="sr-only">Editar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-ink-2">
                  Nenhum lançamento com esses filtros.
                </td>
              </tr>
            ) : (
              linhas.map((entry) => {
                const valor = centavosNoMes(entry, workflow, year, monthIndex);
                const parcela = entry.installmentNumber ?? indiceDaParcela(entry, workflow, year, monthIndex, colunas);
                return (
                  <tr key={entry.id}>
                    <td className="border-b border-line px-3 py-3 whitespace-nowrap">
                      <time>
                        {doisDigitos(entry.day)}/{doisDigitos(monthIndex + 1)}
                      </time>
                    </td>
                    <td className="border-b border-line px-3 py-3">{entry.name || entry.description}</td>
                    <td className="border-b border-line px-3 py-3">
                      <Chip>{ROTULO_CATEGORIA[entry.category]}</Chip>
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <Chip>{ROTULO_STATUS[entry.status]}</Chip>
                    </td>
                    <td className="border-b border-line px-3 py-3">{entry.groupName}</td>
                    <td className="border-b border-line px-3 py-3">{entry.sessionName}</td>
                    <td className="border-b border-line px-3 py-3">
                      {entry.description}
                      {parcela ? ` (${parcela}/${entry.installments})` : ""}
                    </td>
                    <td className="border-b border-line px-3 py-3">{entry.justification}</td>
                    <td className="border-b border-line px-3 py-3 text-right whitespace-nowrap">
                      {valor === undefined ? "—" : <Money cents={valor} />}
                    </td>
                    <td className="border-b border-line px-3 py-3 text-right">
                      <Button
                        variant="quiet"
                        className="size-10 px-0"
                        aria-label="Editar"
                        onClick={() => onEditar(entry)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="size-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          aria-hidden="true"
                        >
                          <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
                          <path d="m13.5 6.5 3 3" />
                        </svg>
                      </Button>
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
                colSpan={9}
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
