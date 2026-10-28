"use client";

import { motion } from "motion/react";
import { useEffect, useId, useMemo, useState } from "react";
import { api } from "./api";
import { useToast } from "../../components/ui/toast";
import { CATEGORIAS_TRANSACAO, type BaseResposta, type LinhaBase } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Carregando } from "../../components/ui/esqueleto";
import { ControleExclusao } from "./acoes";
import { Chip } from "../../components/ui/chip";
import { Dialogo } from "../../components/ui/dialogo";
import { Money } from "../../components/ui/money";
import { ItemAnimado, ListaAnimada, Seta, Troca, useCurva } from "../../components/ui/movimento";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { Icone } from "../../components/ui/icone";
import { Vazio } from "../../components/ui/vazio";
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
  month: number;
  groupId: string;
  category: string;
  q: string;
};

type Sessao = { chave: string; nome: string; linhas: LinhaBase[]; totalCents: number };
type Grupo = { nome: string; sessoes: Sessao[]; totalCents: number };

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
  const curva = useCurva();
  const marca = useId();
  // A Base mostra um mês por vez: começa no mês de hoje e o backend corrige se ele estiver fora do workflow.
  const [filtro, setFiltro] = useState<Filtro>({
    year,
    month: new Date().getMonth() + 1,
    groupId: "",
    category: "",
    q: "",
  });
  const [busca, setBusca] = useState("");
  const [lida, setLida] = useState<{ chave: string; dados: BaseResposta } | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [deslize, setDeslize] = useState(0);
  const [aberta, setAberta] = useState<string | null>(null);
  const [fechadas, setFechadas] = useState<Record<string, boolean>>({});

  const chave = `${parametros(filtro)}#${versao}`;
  const dados = lida?.dados ?? null;
  const buscando = lida?.chave !== chave && !falhou;

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
        setLida({ chave, dados: resposta });
        setFalhou(false);
        // Sem mês na resposta (o pedido caiu fora do workflow): fica no primeiro mês que existe.
        const mes = resposta.month ?? resposta.months[0] ?? filtro.month;
        setFiltro((atual) =>
          atual.year === resposta.year && atual.month === mes ? atual : { ...atual, year: resposta.year, month: mes },
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
    // `chave` já resume o filtro e a versão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, toast]);

  const grupos = useMemo(() => agrupar(dados?.rows ?? []), [dados]);
  const sessaoAberta = aberta ? (grupos.flatMap((grupo) => grupo.sessoes).find((item) => item.chave === aberta) ?? null) : null;

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

  function escolherMes(mes: number) {
    setDeslize(Math.sign(mes - filtro.month));
    setAberta(null);
    setFiltro((atual) => ({ ...atual, month: mes }));
  }

  function editar(linha: LinhaBase) {
    setAberta(null);
    onEditar(linha.entryId, linha.number);
  }

  if (!dados) {
    return falhou ? null : <Carregando texto="Carregando lançamentos." linhas={6} />;
  }

  const mes = dados.month ?? filtro.month;
  const totalLinhas = dados.rows.length;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-2">
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
          className={cn(field, "min-w-0 flex-1")}
        />
      </div>

      <div className="min-w-0 overflow-x-auto">
        <div role="group" aria-label="Mês" className="flex w-max min-w-full border-b border-line">
          {dados.months.map((item) => {
            const ativo = item === mes;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={ativo}
                onClick={() => escolherMes(item)}
                className={cn(
                  "etiqueta-botao relative flex min-h-10 items-center px-3 whitespace-nowrap transition-colors",
                  ativo ? "text-brand" : "text-ink-2 hover:text-ink",
                  focusRing,
                )}
              >
                {MESES[item - 1]?.slice(0, 3)}
                {ativo ? (
                  <motion.span
                    layoutId={marca}
                    className="absolute inset-x-0 bottom-0 border-b-2 border-brand"
                    transition={curva}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <motion.div
        animate={{ opacity: buscando ? 0.5 : 1 }}
        transition={curva}
        aria-busy={buscando}
        className="grid min-w-0 gap-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg">
            {MESES[mes - 1]} de {dados.year}
          </h2>
          <p className="flex items-baseline gap-3 text-sm text-ink-2">
            <span>{totalLinhas === 1 ? "1 lançamento" : `${totalLinhas} lançamentos`}</span>
            <span className="etiqueta">Total do mês</span>
            <span className="text-base">
              <Money cents={dados.totalCents} acumulado />
            </span>
          </p>
        </div>

        <Troca id={`${dados.year}-${mes}`} direcao={deslize} className="grid min-w-0 gap-4">
          {grupos.length === 0 ? (
            <Vazio>Nenhum lançamento em {MESES[mes - 1]?.toLowerCase()} com esses filtros.</Vazio>
          ) : (
            grupos.map((grupo) => {
              const fechado = fechadas[grupo.nome] === true;
              return (
                <section key={grupo.nome} aria-label={grupo.nome} className="min-w-0 border border-line bg-surface">
                  <button
                    type="button"
                    aria-expanded={!fechado}
                    onClick={() => setFechadas((atual) => ({ ...atual, [grupo.nome]: !fechado }))}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-3 bg-surface-2 px-4 py-3 text-left",
                      focusRing,
                    )}
                  >
                    <Seta aberto={!fechado} />
                    <span className="min-w-0 flex-1 truncate font-medium">{grupo.nome}</span>
                    <Money cents={grupo.totalCents} />
                  </button>
                  {fechado ? null : (
                    <ListaAnimada className="min-w-0">
                      {grupo.sessoes.map((sessao) => (
                        <ItemAnimado key={sessao.chave} className="min-w-0 border-t border-line">
                          <button
                            type="button"
                            onClick={() => setAberta(sessao.chave)}
                            aria-label={`${sessao.nome}: ver ${sessao.linhas.length} ${sessao.linhas.length === 1 ? "lançamento" : "lançamentos"}`}
                            className={cn(
                              "flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-soft",
                              focusRing,
                            )}
                          >
                            <span className="grid min-w-0 flex-1 gap-1">
                              <span className="truncate font-medium">{sessao.nome}</span>
                              <span className="text-xs text-ink-2">
                                {sessao.linhas.length === 1 ? "1 lançamento" : `${sessao.linhas.length} lançamentos`}
                              </span>
                            </span>
                            <Money cents={sessao.totalCents} />
                            <span aria-hidden="true" className="text-ink-2">
                              ›
                            </span>
                          </button>
                        </ItemAnimado>
                      ))}
                    </ListaAnimada>
                  )}
                </section>
              );
            })
          )}
        </Troca>
      </motion.div>

      <Dialogo
        aberto={sessaoAberta !== null}
        largura="larga"
        onClose={() => setAberta(null)}
        aria-labelledby="titulo-da-sessao"
      >
        {sessaoAberta ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="etiqueta text-ink-2">
                  {MESES[mes - 1]} de {dados.year}
                </p>
                <h2 id="titulo-da-sessao" className="text-lg wrap-break-word">
                  {sessaoAberta.nome}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
                  <span>Total da sessão</span>
                  <span className="whitespace-nowrap">
                    <Money cents={sessaoAberta.totalCents} acumulado />
                  </span>
                </p>
              </div>
              <Button variant="quiet" onClick={() => setAberta(null)}>
                Fechar
              </Button>
            </div>
            <div className="dialog-corpo">
              <ListaAnimada className="border border-line">
                {sessaoAberta.linhas.map((linha) => (
                  <ItemAnimado
                    key={`${linha.entryId}-${linha.number}`}
                    className="grid min-w-0 gap-2 border-b border-line px-4 py-3 last:border-b-0"
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
                    {linha.description || linha.installment ? (
                      <p className="min-w-0 max-w-prose text-sm wrap-break-word">
                        <Descricao linha={linha} />
                      </p>
                    ) : null}
                    {linha.justification ? (
                      <p className="min-w-0 max-w-prose text-sm wrap-break-word text-ink-2">{linha.justification}</p>
                    ) : null}
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                      <Excluir linha={linha} onExcluir={excluir} />
                      <Button
                        variant="quiet"
                        className="size-10 px-0"
                        aria-label="Editar"
                        onClick={() => editar(linha)}
                      >
                        <Icone name="edit" />
                      </Button>
                    </div>
                  </ItemAnimado>
                ))}
              </ListaAnimada>
            </div>
          </>
        ) : null}
      </Dialogo>
    </div>
  );
}

// Grupos e sessões em ordem alfabética; a soma de cada um deixa de fora o cancelado e o estornado, como o total do mês.
function agrupar(linhas: LinhaBase[]): Grupo[] {
  const grupos = new Map<string, Map<string, LinhaBase[]>>();
  for (const linha of linhas) {
    const sessoes = grupos.get(linha.groupName) ?? new Map<string, LinhaBase[]>();
    sessoes.set(linha.sessionName, [...(sessoes.get(linha.sessionName) ?? []), linha]);
    grupos.set(linha.groupName, sessoes);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([nome, sessoes]) => {
      const lista = [...sessoes.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([sessao, itens]) => ({
          chave: `${nome}\u0000${sessao}`,
          nome: sessao,
          linhas: itens,
          totalCents: somar(itens),
        }));
      return { nome, sessoes: lista, totalCents: lista.reduce((soma, item) => soma + item.totalCents, 0) };
    });
}

function somar(linhas: LinhaBase[]) {
  return linhas.reduce(
    (soma, linha) => (linha.situation === "cancelled" || linha.situation === "refunded" ? soma : soma + linha.cents),
    0,
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
  const busca = new URLSearchParams({ year: String(filtro.year), month: String(filtro.month) });
  if (filtro.groupId) busca.set("groupId", filtro.groupId);
  if (filtro.category) busca.set("category", filtro.category);
  if (filtro.q.trim()) busca.set("q", filtro.q.trim());
  return busca.toString();
}

function dataCurta(iso: string) {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}
