"use client";

import { useEffect, useRef, useState } from "react";
import {
  categoriaDeCompromisso,
  tipoDaCategoria,
  type AcumuloEmLote,
  type ConferenciaResposta,
  type GruposResposta,
  type LinhaConferencia,
  type ValorDoMes,
} from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { Chip } from "../../../components/ui/chip";
import { campo, cn, focusRing } from "../../../components/ui/cn";
import { Segmentado } from "../../../components/ui/segmentado";
import { Money } from "../../../components/ui/money";
import { Troca } from "../../../components/ui/movimento";
import { PageHeader } from "../../../components/ui/page-header";
import { Stat } from "../../../components/ui/stat";
import { useToast } from "../../../components/ui/toast";
import { BuscaSessao } from "./busca-sessao";

const field = campo;
const caixa = `size-4 accent-brand ${focusRing}`;

type Situacao = "todas" | "abertas" | "cruzadas" | "propostas";
type Movimento = "todos" | "entradas" | "saidas";

const situacoes: { id: Situacao; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "abertas", label: "Sem lançamento" },
  { id: "cruzadas", label: "Cruzadas" },
  { id: "propostas", label: "Com proposta" },
];

const meses = [
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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(message || "O backend não respondeu.");
  }
  return body as T;
}

function dia(iso: string) {
  const [ano, mes, data] = iso.split("-");
  return `${data}/${mes}/${ano}`;
}

function textoDoVinculo(vinculo: NonNullable<LinhaConferencia["link"]>) {
  return `${vinculo.description} · ${vinculo.groupName} / ${vinculo.sessionName}`;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function rotuloDoCandidato(vinculo: NonNullable<LinhaConferencia["link"]>) {
  return `${tipoDaCategoria(vinculo.category)} · ${textoDoVinculo(vinculo)} · dia ${vinculo.day} · ${reais.format(vinculo.cents / 100)}`;
}

function pedeValorDoMes(candidato: NonNullable<LinhaConferencia["link"]>, cents: number) {
  return categoriaDeCompromisso(candidato.category) && candidato.cents !== cents;
}

function chaveDa(linha: LinhaConferencia) {
  return `${linha.statementId}:${linha.line}`;
}

export default function Conferencia() {
  const toast = useToast();
  const hoje = new Date();
  const [year, setYear] = useState(hoje.getFullYear());
  const [month, setMonth] = useState(hoje.getMonth() + 1);
  const [deslize, setDeslize] = useState(0);
  const [dados, setDados] = useState<ConferenciaResposta | null>(null);
  const [falha, setFalha] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [sessoes, setSessoes] = useState<Array<{ id: string; rotulo: string }>>([]);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [par, setPar] = useState<Record<string, string>>({});
  const [valorMes, setValorMes] = useState<Record<string, ValorDoMes | "">>({});
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [movimento, setMovimento] = useState<Movimento>("todos");
  const [conta, setConta] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({});
  const pedido = `${year}-${month}`;
  const manual = useRef(false);
  const aplicado = useRef("");

  function carregar(alvoAno: number, alvoMes: number) {
    setDados(null);
    setFalha("");
    return api<ConferenciaResposta>(`/api/extratos/conferencia?year=${alvoAno}&month=${alvoMes}`)
      .then((resposta) => {
        aplicado.current = `${resposta.year}-${resposta.month}`;
        setDados(resposta);
      })
      .catch((error: Error) => {
        setFalha(`${alvoAno}-${alvoMes}`);
        toast.erro(error.message);
      });
  }

  useEffect(() => {
    if (aplicado.current === pedido) return;
    let ativo = true;
    const abrir = manual.current ? "" : "&abrir=pendente";
    setDados(null);
    setFalha("");
    api<ConferenciaResposta>(`/api/extratos/conferencia?year=${year}&month=${month}${abrir}`)
      .then((resposta) => {
        if (!ativo) return;
        const recebida = `${resposta.year}-${resposta.month}`;
        aplicado.current = recebida;
        manual.current = true;
        if (recebida !== pedido) {
          setYear(resposta.year);
          setMonth(resposta.month);
        }
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
  }, [pedido, year, month, toast]);

  useEffect(() => {
    let ativo = true;
    api<GruposResposta>("/api/grupos")
      .then((resposta) => {
        if (!ativo) return;
        const nomes = new Map(resposta.groups.map((grupo) => [grupo.id, grupo.name]));
        setSessoes(
          resposta.sessions
            .filter((sessao) => !sessao.endedAt)
            .map((sessao) => ({
              id: sessao.id,
              rotulo: `${nomes.get(sessao.groupId) ?? "Grupo"} / ${sessao.name}`,
            })),
        );
      })
      .catch(() => {
        if (ativo) setSessoes([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  function mudar(delta: number) {
    manual.current = true;
    setDeslize(delta > 0 ? 1 : -1);
    setMarcadas({});
    setEscolha({});
    setValorMes({});
    const data = new Date(year, month - 1 + delta, 1);
    setYear(data.getFullYear());
    setMonth(data.getMonth() + 1);
  }

  function lancamentoDa(linha: LinhaConferencia) {
    return par[chaveDa(linha)] ?? linha.suggestion?.entryId ?? "";
  }

  function sessaoDa(linha: LinhaConferencia) {
    return escolha[chaveDa(linha)] ?? linha.sessionId ?? "";
  }

  async function confirmar(linha: LinhaConferencia, entryId: string) {
    const chave = chaveDa(linha);
    const candidato = linha.candidates.find((item) => item.entryId === entryId);
    const valor = valorMes[chave];
    if (!entryId) {
      toast.erro("Escolha o lançamento desta linha.");
      return;
    }
    if (candidato && pedeValorDoMes(candidato, linha.cents) && !valor) {
      toast.erro("Escolha o valor deste mês: o do extrato ou o do lançamento.");
      return;
    }
    setOcupado(chave);
    try {
      await api("/api/extratos/cruzamentos", {
        method: "POST",
        body: JSON.stringify({
          statementId: linha.statementId,
          line: linha.line,
          entryId,
          ...(valor ? { valor } : {}),
        }),
      });
      toast.sucesso("Cruzamento confirmado. A ocorrência do mês ficou paga.");
      setPar({});
      setValorMes({});
      await carregar(year, month);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível confirmar o cruzamento.");
    } finally {
      setOcupado("");
    }
  }

  async function acumular(linha: LinhaConferencia) {
    const chave = chaveDa(linha);
    const sessionId = sessaoDa(linha);
    if (!sessionId) {
      toast.erro("Escolha a sessão para acumular.");
      return;
    }
    setOcupado(chave);
    try {
      await api("/api/extratos/acumular", {
        method: "POST",
        body: JSON.stringify({ statementId: linha.statementId, line: linha.line, sessionId }),
      });
      toast.sucesso("Linha lançada na sessão. O nome fica lembrado para a próxima importação.");
      setPar({});
      await carregar(year, month);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível acumular a linha.");
    } finally {
      setOcupado("");
    }
  }

  function avisarLote(resultado: AcumuloEmLote) {
    if (resultado.failed.length === 0) {
      toast.sucesso(
        resultado.launched === 1 ? "1 linha lançada na sessão." : `${resultado.launched} linhas lançadas na sessão.`,
      );
      return;
    }
    if (resultado.launched === 0) {
      toast.erro(resultado.failed[0]?.message || "Não foi possível lançar as linhas.");
      return;
    }
    toast.alerta(`${resultado.launched} lançadas. ${resultado.failed.length} não entraram.`);
  }

  async function lancarItens(itens: { statementId: string; line: number; sessionId: string }[]) {
    const preenchidos = itens.filter((item) => item.sessionId);
    if (!preenchidos.length) {
      toast.erro("Preencha a sessão das linhas para lançar.");
      return;
    }
    setOcupado("lote");
    try {
      const resultado = await api<AcumuloEmLote>("/api/extratos/acumular-lote", {
        method: "POST",
        body: JSON.stringify({ items: preenchidos }),
      });
      const falhas = new Set(resultado.failed.map((falha) => `${falha.statementId}:${falha.line}`));
      setEscolha((atual) => {
        const proximo = { ...atual };
        for (const item of preenchidos) {
          if (!falhas.has(`${item.statementId}:${item.line}`)) delete proximo[`${item.statementId}:${item.line}`];
        }
        return proximo;
      });
      setMarcadas({});
      setPar({});
      avisarLote(resultado);
      await carregar(year, month);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível lançar as linhas.");
    } finally {
      setOcupado("");
    }
  }

  function lancarSelecionadas() {
    const escolhidas = linhas.filter((linha) => marcadas[chaveDa(linha)] && !linha.link);
    if (!escolhidas.length) {
      toast.erro("Selecione as linhas para lançar.");
      return;
    }
    return lancarItens(
      escolhidas.flatMap((linha) => {
        const sessionId = sessaoDa(linha);
        if (!sessionId) return [];
        return [{ statementId: linha.statementId, line: linha.line, sessionId }];
      }),
    );
  }

  function lancarAlteradas() {
    return lancarItens(
      linhas.flatMap((linha) => {
        if (linha.link) return [];
        const sessionId = sessaoDa(linha);
        if (!sessionId) return [];
        return [{ statementId: linha.statementId, line: linha.line, sessionId }];
      }),
    );
  }

  const falhou = falha === pedido;
  const linhas = dados?.lines ?? [];
  const termo = busca.trim().toLowerCase();
  const contas = [...new Set(linhas.map((linha) => linha.accountName))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const arquivos = [...new Set(linhas.map((linha) => linha.filename))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filtradas = linhas.filter((linha) => {
    if (termo && ![linha.description, linha.accountName, linha.filename].some((valor) => valor.toLowerCase().includes(termo))) {
      return false;
    }
    if (situacao === "abertas" && linha.link) return false;
    if (situacao === "cruzadas" && !linha.link) return false;
    if (situacao === "propostas" && !linha.suggestion) return false;
    if (movimento === "entradas" && linha.cents <= 0) return false;
    if (movimento === "saidas" && linha.cents >= 0) return false;
    if (conta && linha.accountName !== conta) return false;
    if (arquivo && linha.filename !== arquivo) return false;
    return true;
  });
  const abertasFiltradas = filtradas.filter((linha) => !linha.link);
  const todasMarcadas = abertasFiltradas.length > 0 && abertasFiltradas.every((linha) => marcadas[chaveDa(linha)]);
  const selecionadas = linhas.filter((linha) => marcadas[chaveDa(linha)] && !linha.link).length;
  const alteradas = linhas.filter((linha) => !linha.link && Boolean(sessaoDa(linha))).length;
  const entradas = linhas.reduce((soma, linha) => soma + (linha.cents > 0 ? linha.cents : 0), 0);
  const saidas = linhas.reduce((soma, linha) => soma + (linha.cents < 0 ? linha.cents : 0), 0);
  const cruzadas = linhas.filter((linha) => linha.link).length;
  const ordenadas = [...filtradas].sort((a, b) => a.date.localeCompare(b.date) || a.line - b.line);
  const dias = ordenadas.reduce<{ data: string; itens: LinhaConferencia[] }[]>((grupos, linha) => {
    const atual = grupos.at(-1);
    if (atual?.data === linha.date) atual.itens.push(linha);
    else grupos.push({ data: linha.date, itens: [linha] });
    return grupos;
  }, []);

  return (
    <>
      <PageHeader
        title="Conferência"
        subtitle="Cada linha do banco precisa de um lançamento. O nome do extrato fica lembrado para a próxima importação."
        actions={
          <div className="flex items-center gap-1 font-display text-lg font-bold">
            <Button variant="quiet" className="min-w-10 px-0" aria-label="Mês anterior" onClick={() => mudar(-1)}>
              ‹
            </Button>
            <span>
              {meses[month - 1]} de {year}
            </span>
            <Button variant="quiet" className="min-w-10 px-0" aria-label="Próximo mês" onClick={() => mudar(1)}>
              ›
            </Button>
          </div>
        }
      />
      <Troca id={`${year}-${month}`} direcao={deslize} className="min-w-0">
      {!dados && !falhou ? <p className="text-sm text-ink-2">Carregando conferência.</p> : null}
      {dados ? (
        <div className="grid min-w-0 gap-4">
          {linhas.length ? (
            <dl className="flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-4" aria-label="Resumo do extrato">
              <Stat label="Entradas">
                <Money cents={entradas} acumulado />
              </Stat>
              <Stat label="Saídas">
                <Money cents={saidas} acumulado />
              </Stat>
              <Stat label="Sobra">
                <Money cents={entradas + saidas} acumulado />
              </Stat>
              <Stat label="Sem lançamento">{dados.pending}</Stat>
              <Stat label="Com sessão">{alteradas}</Stat>
              <Stat label="Cruzadas">{cruzadas}</Stat>
            </dl>
          ) : null}
          <input
            className={cn(field, "w-full")}
            type="search"
            placeholder="Buscar por nome, conta ou arquivo"
            aria-label="Buscar"
            value={busca}
            onChange={(event) => {
              setBusca(event.target.value);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Segmentado
              opcoes={situacoes}
              valor={situacao}
              aria-label="Situação"
              onEscolher={(valor) => {
                setSituacao(valor);
              }}
            />
            <select
              className={cn(field, "w-auto")}
              aria-label="Movimento"
              value={movimento}
              onChange={(event) => {
                setMovimento(event.target.value as Movimento);
              }}
            >
              <option value="todos">Entradas e saídas</option>
              <option value="entradas">Entradas</option>
              <option value="saidas">Saídas</option>
            </select>
            {contas.length > 1 ? (
              <select
                className={cn(field, "w-auto")}
                aria-label="Conta"
                value={conta}
                onChange={(event) => {
                  setConta(event.target.value);
                }}
              >
                <option value="">Todas as contas</option>
                {contas.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            ) : null}
            {arquivos.length > 1 ? (
              <select
                className={cn(field, "w-auto max-w-full")}
                aria-label="Arquivo"
                value={arquivo}
                onChange={(event) => {
                  setArquivo(event.target.value);
                }}
              >
                <option value="">Todos os arquivos</option>
                {arquivos.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {abertasFiltradas.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className={caixa}
                  checked={todasMarcadas}
                  onChange={(event) => {
                    const marcado = event.target.checked;
                    setMarcadas((atual) => {
                      const proximo = { ...atual };
                      for (const linha of abertasFiltradas) {
                        if (marcado) proximo[chaveDa(linha)] = true;
                        else delete proximo[chaveDa(linha)];
                      }
                      return proximo;
                    });
                  }}
                />
                Selecionar sem lançamento
              </label>
              <Button
                variant="primary"
                disabled={ocupado !== "" || selecionadas === 0}
                onClick={() => void lancarSelecionadas()}
              >
                {selecionadas > 0 ? `Lançar ${selecionadas}` : "Lançar selecionadas"}
              </Button>
              <Button disabled={ocupado !== "" || alteradas === 0} onClick={() => void lancarAlteradas()}>
                {alteradas > 0 ? `Lançar ${alteradas} alteradas` : "Lançar alteradas"}
              </Button>
            </div>
          ) : null}
          <div className="min-w-0 overflow-visible rounded-lg border border-line bg-surface">
            {dias.length ? (
              dias.map((grupo) => {
                const entradasDia = grupo.itens.reduce((soma, linha) => soma + (linha.cents > 0 ? linha.cents : 0), 0);
                const saidasDia = grupo.itens.reduce((soma, linha) => soma + (linha.cents < 0 ? linha.cents : 0), 0);
                return (
                  <section key={grupo.data} aria-label={dia(grupo.data)}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
                      <span className="font-display text-sm font-bold">{dia(grupo.data)}</span>
                      <span className="flex gap-4 text-sm">
                        <span>{grupo.itens.length === 1 ? "1 linha" : `${grupo.itens.length} linhas`}</span>
                        <Money cents={entradasDia} />
                        <Money cents={saidasDia} />
                      </span>
                    </div>
                    <ul>
                      {grupo.itens.map((linha) => (
                        <li
                          key={`${linha.statementId}-${linha.line}`}
                          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2 last:border-b-0"
                        >
                          {linha.link ? (
                            <span className="size-4" />
                          ) : (
                            <input
                              type="checkbox"
                              className={caixa}
                              aria-label={`Selecionar ${linha.description || "a linha"}`}
                              checked={marcadas[chaveDa(linha)] === true}
                              onChange={(event) =>
                                setMarcadas((atual) => ({ ...atual, [chaveDa(linha)]: event.target.checked }))
                              }
                            />
                          )}
                          <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="min-w-0 font-medium">{linha.description || "—"}</span>
                            {linha.link ? <Chip tone="ok">Cruzado</Chip> : null}
                            {!linha.link && linha.suggestion ? (
                              <Chip tone="ai">{linha.suggestionSource === "nome" ? "Nome" : "Valor"}</Chip>
                            ) : null}
                            {contas.length > 1 ? <span className="text-sm text-ink-2">{linha.accountName}</span> : null}
                            {arquivos.length > 1 ? <span className="text-sm text-ink-2">{linha.filename}</span> : null}
                          </span>
                          {linha.link ? (
                            <span className="col-start-2 row-start-2 min-w-0 text-sm text-ink-2">{textoDoVinculo(linha.link)}</span>
                          ) : sessoes.length ? (
                            <BuscaSessao
                              className="col-start-2 row-start-2 min-w-0"
                              sessoes={sessoes}
                              valor={sessaoDa(linha)}
                              rotulo={`Sessão para ${linha.description || "a linha"}`}
                              onEscolher={(id) => setEscolha((atual) => ({ ...atual, [chaveDa(linha)]: id }))}
                            />
                          ) : (
                            <span className="col-start-2 row-start-2 text-sm text-ink-2">Crie uma sessão em Grupos.</span>
                          )}
                          <Money cents={linha.cents} strong />
                          {linha.link ? null : (
                            <Button
                              className="col-start-3 row-start-2"
                              variant="quiet"
                              disabled={ocupado !== "" || !sessaoDa(linha)}
                              onClick={() => void acumular(linha)}
                            >
                              Acumular
                            </Button>
                          )}
                          {!linha.link && linha.candidates.length ? (
                            <div className="col-span-2 col-start-2 row-start-3 flex flex-wrap items-center gap-2">
                              <select
                                className={cn(field, "w-full min-w-0 flex-1 desk:w-auto")}
                                aria-label={`Lançamento para ${linha.description || "a linha"}`}
                                value={lancamentoDa(linha)}
                                onChange={(event) => {
                                  const chave = chaveDa(linha);
                                  setPar((atual) => ({ ...atual, [chave]: event.target.value }));
                                  setValorMes((atual) => ({ ...atual, [chave]: "" }));
                                }}
                              >
                                <option value="">Escolha o lançamento</option>
                                {linha.candidates.map((candidato) => (
                                  <option key={candidato.entryId} value={candidato.entryId}>
                                    {rotuloDoCandidato(candidato)}
                                  </option>
                                ))}
                              </select>
                              {(() => {
                                const candidato = linha.candidates.find((item) => item.entryId === lancamentoDa(linha));
                                if (!candidato || !pedeValorDoMes(candidato, linha.cents)) return null;
                                const escolha = valorMes[chaveDa(linha)] || "";
                                return (
                                  <span className="flex w-full flex-wrap items-center gap-2">
                                    <span className="text-sm text-ink-2">Os valores divergem. Qual vale neste mês?</span>
                                    <Segmentado<"" | ValorDoMes>
                                      aria-label="Valor deste mês"
                                      opcoes={[
                                        { id: "extrato", label: `Extrato ${reais.format(linha.cents / 100)}` },
                                        { id: "lancamento", label: `Lançamento ${reais.format(candidato.cents / 100)}` },
                                      ]}
                                      valor={escolha}
                                      onEscolher={(id) => {
                                        if (!id) return;
                                        setValorMes((atual) => ({ ...atual, [chaveDa(linha)]: id }));
                                      }}
                                    />
                                  </span>
                                );
                              })()}
                              <Button
                                variant="default"
                                disabled={
                                  ocupado !== "" ||
                                  !lancamentoDa(linha) ||
                                  linha.candidates.some(
                                    (item) =>
                                      item.entryId === lancamentoDa(linha) &&
                                      pedeValorDoMes(item, linha.cents) &&
                                      !valorMes[chaveDa(linha)],
                                  )
                                }
                                onClick={() => void confirmar(linha, lancamentoDa(linha))}
                              >
                                Confirmar
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            ) : (
              <p className="px-6 py-6 text-center text-ink-2">
                {linhas.length
                  ? "Nenhuma linha com esses filtros."
                  : "Nenhuma linha lida neste mês. Importe um extrato em Importações."}
              </p>
            )}
          </div>
        </div>
      ) : null}
      </Troca>
    </>
  );
}
