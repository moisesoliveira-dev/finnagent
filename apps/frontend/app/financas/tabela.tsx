"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { useToast } from "../../components/ui/toast";
import { CATEGORIAS_TRANSACAO, type BaseResposta, type LinhaBase } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Carregando } from "../../components/ui/esqueleto";
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

type Filtro = {
  year: number;
  month: number | null;
  day: number | null;
  groupId: string;
  category: string;
  q: string;
};

export function TabelaLancamentos({
  year,
  versao,
  onEditar,
  onAtualizar,
}: {
  year: number;
  versao: number;
  onEditar: (entryId: string, numero: number) => void;
  onAtualizar: () => Promise<void>;
}) {
  const toast = useToast();
  const [filtro, setFiltro] = useState<Filtro>({
    year,
    month: null,
    day: null,
    groupId: "",
    category: "",
    q: "",
  });
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState<BaseResposta | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const espera = setTimeout(() => {
      setFiltro((atual) => (atual.q === busca ? atual : { ...atual, q: busca }));
    }, 250);
    return () => clearTimeout(espera);
  }, [busca]);

  useEffect(() => {
    let ativo = true;
    api<BaseResposta>(`/api/financas/base?${parametros(filtro)}`)
      .then((resposta) => {
        if (!ativo) return;
        setDados(resposta);
        setFalhou(false);
        setFiltro((atual) =>
          atual.year === resposta.year && atual.month === resposta.month && atual.day === resposta.day
            ? atual
            : { ...atual, year: resposta.year, month: resposta.month, day: resposta.day },
        );
      })
      .catch((error: Error) => {
        if (!ativo) return;
        setFalhou(true);
        toast.erro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, [filtro, versao, toast]);

  async function excluir(linha: LinhaBase) {
    try {
      const resposta = await api<{ removed: "entry" | "occurrence" }>(
        `/api/lancamentos/${linha.entryId}/ocorrencias/${linha.number}`,
        { method: "DELETE" },
      );
      toast.sucesso(resposta.removed === "entry" ? "Lançamento apagado." : "Mês apagado.");
      await onAtualizar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível apagar.");
      throw error;
    }
  }

  if (!dados) {
    return falhou ? null : (
      <Carregando texto="Carregando lançamentos." linhas={6} />
    );
  }

  const linhas = dados.rows;
  const rotuloTotal =
    dados.day != null ? "Total do dia" : dados.month == null ? "Total do ano" : "Total do mês";

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Ano"
          value={dados.year}
          onChange={(event) => setFiltro((atual) => ({ ...atual, year: Number(event.target.value) }))}
          className={field}
        >
          {dados.years.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          aria-label="Mês"
          value={dados.month ?? ""}
          onChange={(event) =>
            setFiltro((atual) => ({
              ...atual,
              month: event.target.value === "" ? null : Number(event.target.value),
            }))
          }
          className={field}
        >
          <option value="">Todos os meses</option>
          {dados.months.map((mes) => (
            <option key={mes} value={mes}>
              {MESES[mes - 1]}
            </option>
          ))}
        </select>
        <select
          aria-label="Dia"
          value={dados.day ?? ""}
          disabled={dados.days.length === 0}
          onChange={(event) =>
            setFiltro((atual) => ({
              ...atual,
              day: event.target.value === "" ? null : Number(event.target.value),
            }))
          }
          className={field}
        >
          <option value="">Todos os dias</option>
          {dados.days.map((item) => (
            <option key={item} value={item}>
              {doisDigitos(item)}
            </option>
          ))}
        </select>
        <select
          aria-label="Grupo"
          value={filtro.groupId}
          onChange={(event) => setFiltro((atual) => ({ ...atual, groupId: event.target.value }))}
          className={field}
        >
          <option value="">Todos os grupos</option>
          {dados.groups.map((grupo) => (
            <option key={grupo.id} value={grupo.id}>
              {grupo.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Categoria"
          value={filtro.category}
          onChange={(event) => setFiltro((atual) => ({ ...atual, category: event.target.value }))}
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
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
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
            linhas.map((linha) => (
              <li
                key={`${linha.entryId}-${linha.number}`}
                className="grid min-w-0 gap-3 border-b border-line px-4 py-3"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <time className="text-sm text-ink-2" dateTime={linha.dueDate}>
                      {dataCurta(linha.dueDate)}
                    </time>
                    <div className="font-medium wrap-break-word">{linha.name || linha.description}</div>
                  </div>
                  <div className="shrink-0">
                    <Money cents={linha.cents} />
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Chip>{ROTULO_CATEGORIA[linha.category]}</Chip>
                  <Chip tone={tomDaSituacao(linha.situation)}>{rotuloDaSituacao(linha.situation)}</Chip>
                  <Chip tone={tomDaPrioridade(linha.priority)}>{ROTULO_PRIORIDADE[linha.priority]}</Chip>
                </div>
                <p className="min-w-0 max-w-prose text-sm wrap-break-word text-ink-2">
                  {linha.groupName} · {linha.sessionName}
                </p>
                {linha.description || linha.installment ? (
                  <p className="min-w-0 max-w-prose text-sm wrap-break-word">
                    <Descricao linha={linha} />
                  </p>
                ) : null}
                {linha.justification ? (
                  <p className="min-w-0 max-w-prose text-sm wrap-break-word text-ink-2">{linha.justification}</p>
                ) : null}
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  <Excluir linha={linha} onExcluir={excluir} />
                  <Button
                    variant="quiet"
                    className="size-10 px-0"
                    aria-label="Editar"
                    onClick={() => onEditar(linha.entryId, linha.number)}
                  >
                    <Icone name="edit" />
                  </Button>
                </div>
              </li>
            ))
          )}
          <li className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 font-semibold">
            <span className="min-w-0">{rotuloTotal}</span>
            <span className="shrink-0">
              <Money cents={dados.totalCents} acumulado />
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
              linhas.map((linha) => (
                <tr key={`${linha.entryId}-${linha.number}`}>
                  <td className="border-b border-line px-3 py-3 whitespace-nowrap">
                    <time dateTime={linha.dueDate}>{dataCurta(linha.dueDate)}</time>
                  </td>
                  <td className="border-b border-line px-3 py-3">{linha.name || linha.description}</td>
                  <td className="border-b border-line px-3 py-3">
                    <Chip>{ROTULO_CATEGORIA[linha.category]}</Chip>
                  </td>
                  <td className="border-b border-line px-3 py-3">
                    <Chip tone={tomDaSituacao(linha.situation)}>{rotuloDaSituacao(linha.situation)}</Chip>
                  </td>
                  <td className="border-b border-line px-3 py-3">
                    <Chip tone={tomDaPrioridade(linha.priority)}>{ROTULO_PRIORIDADE[linha.priority]}</Chip>
                  </td>
                  <td className="border-b border-line px-3 py-3">{linha.groupName}</td>
                  <td className="border-b border-line px-3 py-3">{linha.sessionName}</td>
                  <td className="border-b border-line px-3 py-3">
                    <Descricao linha={linha} />
                  </td>
                  <td className="border-b border-line px-3 py-3">{linha.justification}</td>
                  <td className="border-b border-line px-3 py-3 text-right whitespace-nowrap">
                    <Money cents={linha.cents} />
                  </td>
                  <td className="border-b border-line px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Excluir linha={linha} onExcluir={excluir} />
                      <Button
                        variant="quiet"
                        className="size-10 px-0"
                        aria-label="Editar"
                        onClick={() => onEditar(linha.entryId, linha.number)}
                      >
                        <Icone name="edit" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={10} className="px-3 py-3 text-left font-semibold">
                {rotuloTotal}
              </th>
              <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                <Money cents={dados.totalCents} acumulado />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Descricao({ linha }: { linha: LinhaBase }) {
  return (
    <>
      {linha.description}
      {linha.installment ? ` (${linha.installment.number}/${linha.installment.total})` : ""}
    </>
  );
}

function Excluir({ linha, onExcluir }: { linha: LinhaBase; onExcluir: (linha: LinhaBase) => Promise<void> }) {
  if (linha.remove === null && !linha.synced) return null;
  return (
    <ControleExclusao
      compact
      removivel={linha.remove !== null}
      rotulo={linha.remove === "occurrence" ? "Excluir este mês" : "Excluir lançamento"}
      onExcluir={() => onExcluir(linha)}
    />
  );
}

function parametros(filtro: Filtro) {
  const busca = new URLSearchParams({ year: String(filtro.year) });
  if (filtro.month != null) busca.set("month", String(filtro.month));
  if (filtro.day != null) busca.set("day", String(filtro.day));
  if (filtro.groupId) busca.set("groupId", filtro.groupId);
  if (filtro.category) busca.set("category", filtro.category);
  if (filtro.q.trim()) busca.set("q", filtro.q.trim());
  return busca.toString();
}

function dataCurta(iso: string) {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}
