"use client";

import { useState } from "react";
import {
  CATEGORIAS_TRANSACAO,
  centavosNoMes,
  colunasDoAno,
  diaLocal,
  indiceDaParcela,
  ocorreNoMes,
  situacaoDoLancamento,
  somaDosCentavos,
  type Lancamento,
  type Workflow,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { ControleExclusao } from "./acoes";
import { Chip } from "../../components/ui/chip";
import { List } from "../../components/ui/list";
import { Money } from "../../components/ui/money";
import { campo } from "../../components/ui/cn";
import { Icone } from "../../components/ui/icone";
import { doisDigitos } from "./reais";
import { ROTULO_CATEGORIA, ROTULO_PRIORIDADE, rotuloDaSituacao, tomDaPrioridade, tomDaSituacao } from "./rotulos";

const field = campo;

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

export function TabelaLancamentos({
  entries,
  workflow,
  year,
  onEditar,
  onExcluir,
}: {
  entries: Lancamento[];
  workflow: Workflow;
  year: number;
  onEditar: (entry: Lancamento) => void;
  onExcluir: (entry: Lancamento) => Promise<void>;
}) {
  const [anoFiltro, setAnoFiltro] = useState(year);
  const [month, setMonth] = useState<number | "">("");
  const [day, setDay] = useState<number | "">("");
  const [groupId, setGroupId] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const colunas = colunasDoAno(workflow, anoFiltro);
  const anos = anosDoFiltro(workflow, entries, year);
  const dias = month === "" ? [] : diasDoMes(anoFiltro, month, workflow);
  const grupos = gruposDe(entries);
  const busca = query.trim().toLowerCase();
  const linhas = entries
    .filter((entry) => {
      if (!ocorreNoFiltro(entry, workflow, anoFiltro, colunas, month)) return false;
      if (day !== "" && entry.day !== day) return false;
      if (groupId && entry.groupId !== groupId) return false;
      if (category && entry.category !== category) return false;
      if (!busca) return true;
      return `${entry.name} ${entry.description} ${entry.justification} ${entry.sessionName}`
        .toLowerCase()
        .includes(busca);
    })
    .sort((a, b) => {
      const mesA = primeiroMes(a, workflow, anoFiltro, colunas, month);
      const mesB = primeiroMes(b, workflow, anoFiltro, colunas, month);
      if (mesA !== mesB) return mesA - mesB;
      return a.day - b.day;
    });
  const total = somaDosCentavos(
    linhas.map((entry) => valorNoFiltro(entry, workflow, anoFiltro, colunas, month)),
  );
  const rotuloTotal = day !== "" ? "Total do dia" : month === "" ? "Total do ano" : "Total do mês";

  function escolherAno(proximo: number) {
    const meses = colunasDoAno(workflow, proximo);
    setAnoFiltro(proximo);
    if (month !== "" && !meses.includes(month)) {
      setMonth("");
      setDay("");
      return;
    }
    if (month !== "" && day !== "" && !diasDoMes(proximo, month, workflow).includes(day)) {
      setDay("");
    }
  }

  function escolherMes(valor: string) {
    if (valor === "") {
      setMonth("");
      setDay("");
      return;
    }
    const proximo = Number(valor);
    setMonth(proximo);
    if (day !== "" && !diasDoMes(anoFiltro, proximo, workflow).includes(day)) setDay("");
  }

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
          aria-label="Ano"
          value={anoFiltro}
          onChange={(event) => escolherAno(Number(event.target.value))}
          className={field}
        >
          {anos.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          aria-label="Mês"
          value={month}
          onChange={(event) => escolherMes(event.target.value)}
          className={field}
        >
          <option value="">Todos os meses</option>
          {colunas.map((coluna) => (
            <option key={coluna} value={coluna}>
              {MESES[coluna]}
            </option>
          ))}
        </select>
        <select
          aria-label="Dia"
          value={day}
          disabled={month === ""}
          onChange={(event) => setDay(event.target.value === "" ? "" : Number(event.target.value))}
          className={field}
        >
          <option value="">Todos os dias</option>
          {dias.map((item) => (
            <option key={item} value={item}>
              {doisDigitos(item)}
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
          className={`${field} min-w-0 flex-1`}
        />
      </div>
      <div className="min-w-0 tab:hidden">
        <List>
          {linhas.length === 0 ? (
            <li className="min-w-0 border-b border-line px-4 py-6 text-sm text-ink-2">
              <p className="max-w-prose">Nenhum lançamento com esses filtros.</p>
            </li>
          ) : (
            linhas.map((entry) => {
              const mesDaLinha = primeiroMes(entry, workflow, anoFiltro, colunas, month);
              const valor = valorNoFiltro(entry, workflow, anoFiltro, colunas, month);
              const parcela =
                entry.installmentNumber ?? indiceDaParcela(entry, workflow, anoFiltro, mesDaLinha, colunas);
              return (
                <li key={entry.id} className="grid min-w-0 gap-3 border-b border-line px-4 py-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <time className="text-sm text-ink-2">
                        {doisDigitos(entry.day)}/{doisDigitos(mesDaLinha + 1)}
                      </time>
                      <div className="font-medium wrap-break-word">{entry.name || entry.description}</div>
                    </div>
                    <div className="shrink-0">{valor === undefined ? "—" : <Money cents={valor} />}</div>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Chip>{ROTULO_CATEGORIA[entry.category]}</Chip>
                    <Chip tone={tomDaSituacao(situacaoDoLancamento(entry, diaLocal()))}>
                      {rotuloDaSituacao(situacaoDoLancamento(entry, diaLocal()))}
                    </Chip>
                    <Chip tone={tomDaPrioridade(entry.priority)}>{ROTULO_PRIORIDADE[entry.priority]}</Chip>
                  </div>
                  <p className="min-w-0 max-w-prose text-sm wrap-break-word text-ink-2">
                    {entry.groupName} · {entry.sessionName}
                  </p>
                  {entry.description || parcela ? (
                    <p className="min-w-0 max-w-prose text-sm wrap-break-word">
                      {entry.description}
                      {parcela ? ` (${parcela}/${entry.installments})` : ""}
                    </p>
                  ) : null}
                  {entry.justification ? (
                    <p className="min-w-0 max-w-prose text-sm wrap-break-word text-ink-2">{entry.justification}</p>
                  ) : null}
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                    <ControleExclusao compact synced={entry.synced} onExcluir={() => onExcluir(entry)} />
                    <Button variant="quiet" aria-label="Editar" onClick={() => onEditar(entry)}>
                      <Icone name="edit" />
                    </Button>
                  </div>
                </li>
              );
            })
          )}
          <li className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 font-semibold">
            <span className="min-w-0">{rotuloTotal}</span>
            <span className="shrink-0">
              <Money cents={total} acumulado />
            </span>
          </li>
        </List>
      </div>
      <div className="hidden min-w-0 overflow-x-auto rounded-lg border border-line bg-surface tab:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Lançamentos filtrados</caption>
          <thead>
            <tr>
              {["Data", "Nome", "Categoria", "Status", "Prioridade", "Grupo", "Sessão", "Descrição", "Justificativa"].map((coluna) => (
                <th
                  key={coluna}
                  scope="col"
                  className="border-b border-line bg-surface px-3 py-3 text-left align-top etiqueta text-ink-2"
                >
                  {coluna}
                </th>
              ))}
              <th
                scope="col"
                className="border-b border-line bg-surface px-3 py-3 text-right align-top etiqueta whitespace-nowrap text-ink-2"
              >
                Valor
              </th>
              <th scope="col" className="border-b border-line bg-surface px-3 py-3 text-right">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-ink-2">
                  Nenhum lançamento com esses filtros.
                </td>
              </tr>
            ) : (
              linhas.map((entry) => {
                const mesDaLinha = primeiroMes(entry, workflow, anoFiltro, colunas, month);
                const valor = valorNoFiltro(entry, workflow, anoFiltro, colunas, month);
                const parcela =
                  entry.installmentNumber ??
                  indiceDaParcela(entry, workflow, anoFiltro, mesDaLinha, colunas);
                return (
                  <tr key={entry.id}>
                    <td className="border-b border-line px-3 py-3 whitespace-nowrap">
                      <time>
                        {doisDigitos(entry.day)}/{doisDigitos(mesDaLinha + 1)}
                      </time>
                    </td>
                    <td className="border-b border-line px-3 py-3">{entry.name || entry.description}</td>
                    <td className="border-b border-line px-3 py-3">
                      <Chip>{ROTULO_CATEGORIA[entry.category]}</Chip>
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <Chip tone={tomDaSituacao(situacaoDoLancamento(entry, diaLocal()))}>
                      {rotuloDaSituacao(situacaoDoLancamento(entry, diaLocal()))}
                    </Chip>
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <Chip tone={tomDaPrioridade(entry.priority)}>{ROTULO_PRIORIDADE[entry.priority]}</Chip>
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
                      <div className="flex items-center justify-end gap-1">
                        <ControleExclusao compact synced={entry.synced} onExcluir={() => onExcluir(entry)} />
                      <Button
                        variant="quiet"
                        className="size-10 px-0"
                        aria-label="Editar"
                        onClick={() => onEditar(entry)}
                      >
                        <Icone name="edit" />
                      </Button>
                      </div>
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
                colSpan={10}
                className="px-3 py-3 text-left font-semibold"
              >
                {rotuloTotal}
              </th>
              <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                <Money cents={total} acumulado />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function anosDoFiltro(workflow: Workflow, entries: Lancamento[], atual: number) {
  let fim = Math.max(workflow.year, atual, new Date().getFullYear());
  for (const entry of entries) {
    fim = Math.max(fim, entry.startYear);
    for (const mes of entry.months) fim = Math.max(fim, mes.year);
    if (entry.installments && entry.installments > 0) {
      const ultimo = entry.startYear * 12 + (entry.startMonth - 1) + entry.installments - 1;
      fim = Math.max(fim, Math.floor(ultimo / 12));
    }
  }
  const inicio = workflow.year;
  return Array.from({ length: Math.max(fim, inicio) - inicio + 1 }, (_, indice) => inicio + indice);
}

function diasDoMes(year: number, monthIndex: number, workflow: Workflow) {
  const ultimo = new Date(year, monthIndex + 1, 0).getDate();
  const inicio =
    year === workflow.year && monthIndex === workflow.month - 1 ? workflow.day : 1;
  return Array.from({ length: Math.max(ultimo - inicio + 1, 0) }, (_, indice) => inicio + indice);
}

function ocorreNoFiltro(
  entry: Lancamento,
  workflow: Workflow,
  year: number,
  colunas: number[],
  month: number | "",
) {
  if (month === "") return colunas.some((coluna) => ocorreNoMes(entry, workflow, year, coluna));
  return ocorreNoMes(entry, workflow, year, month);
}

function primeiroMes(
  entry: Lancamento,
  workflow: Workflow,
  year: number,
  colunas: number[],
  month: number | "",
) {
  if (month !== "") return month;
  return colunas.find((coluna) => ocorreNoMes(entry, workflow, year, coluna)) ?? entry.startMonth - 1;
}

function valorNoFiltro(
  entry: Lancamento,
  workflow: Workflow,
  year: number,
  colunas: number[],
  month: number | "",
) {
  if (month !== "") return centavosNoMes(entry, workflow, year, month);
  return somaDosCentavos(
    colunas.map((coluna) => centavosNoMes(entry, workflow, year, coluna)),
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
