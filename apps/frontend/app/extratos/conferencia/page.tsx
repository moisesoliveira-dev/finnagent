"use client";

import { useEffect, useRef, useState } from "react";
import type { AcumuloEmLote, ConferenciaResposta, GruposResposta, LinhaConferencia } from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { Chip } from "../../../components/ui/chip";
import { campo, cn, focusRing } from "../../../components/ui/cn";
import { Segmentado } from "../../../components/ui/segmentado";
import { Money } from "../../../components/ui/money";
import { Troca } from "../../../components/ui/movimento";
import { PageHeader } from "../../../components/ui/page-header";
import { PendingAction } from "../../../components/ui/pending-action";
import { useToast } from "../../../components/ui/toast";

const field = campo;
const caixa = `size-4 accent-brand ${focusRing}`;
const POR_PAGINA = 20;

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
  return `${textoDoVinculo(vinculo)} · dia ${vinculo.day} · ${reais.format(vinculo.cents / 100)}`;
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
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [movimento, setMovimento] = useState<Movimento>("todos");
  const [conta, setConta] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({});
  const [sessaoLote, setSessaoLote] = useState("");
  const [pagina, setPagina] = useState(1);
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
    setPagina(1);
    setMarcadas({});
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
    if (!entryId) {
      toast.erro("Escolha o lançamento desta linha.");
      return;
    }
    setOcupado(chave);
    try {
      await api("/api/extratos/cruzamentos", {
        method: "POST",
        body: JSON.stringify({ statementId: linha.statementId, line: linha.line, entryId }),
      });
      toast.sucesso("Cruzamento confirmado. A ocorrência do mês ficou paga.");
      setPar({});
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

  async function lancarSelecionadas() {
    const escolhidas = linhas.filter((linha) => marcadas[chaveDa(linha)] && !linha.link);
    if (!escolhidas.length) {
      toast.erro("Selecione as linhas para lançar.");
      return;
    }
    if (!sessaoLote) {
      toast.erro("Escolha a sessão para lançar as selecionadas.");
      return;
    }
    setOcupado("lote");
    try {
      const resultado = await api<AcumuloEmLote>("/api/extratos/acumular-lote", {
        method: "POST",
        body: JSON.stringify({
          items: escolhidas.map((linha) => ({
            statementId: linha.statementId,
            line: linha.line,
            sessionId: sessaoLote,
          })),
        }),
      });
      setMarcadas({});
      setPar({});
      if (resultado.failed.length === 0) {
        toast.sucesso(
          resultado.launched === 1
            ? "1 linha lançada na sessão."
            : `${resultado.launched} linhas lançadas na sessão.`,
        );
      } else if (resultado.launched === 0) {
        toast.erro(resultado.failed[0]?.message || "Não foi possível lançar as linhas.");
      } else {
        toast.alerta(`${resultado.launched} lançadas. ${resultado.failed.length} não entraram.`);
      }
      await carregar(year, month);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível lançar as linhas.");
    } finally {
      setOcupado("");
    }
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
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas);
  const inicio = filtradas.length === 0 ? 0 : (paginaAtual - 1) * POR_PAGINA;
  const visiveis = filtradas.slice(inicio, inicio + POR_PAGINA);
  const propostas = visiveis.filter((linha) => linha.suggestion);

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
        <div className="grid items-start gap-6 desk:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid min-w-0 gap-4">
          {linhas.length ? (
            <p className="text-sm text-ink-2" aria-live="polite">
              {dados.pending === 0
                ? "Todas as linhas do mês têm lançamento."
                : dados.pending === 1
                  ? "1 linha do mês ainda sem lançamento."
                  : `${dados.pending} linhas do mês ainda sem lançamento.`}
            </p>
          ) : null}
          <input
            className={cn(field, "w-full")}
            type="search"
            placeholder="Buscar por nome, conta ou arquivo"
            aria-label="Buscar"
            value={busca}
            onChange={(event) => {
              setBusca(event.target.value);
              setPagina(1);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Segmentado
              opcoes={situacoes}
              valor={situacao}
              aria-label="Situação"
              onEscolher={(valor) => {
                setSituacao(valor);
                setPagina(1);
              }}
            />
            <select
              className={cn(field, "w-auto")}
              aria-label="Movimento"
              value={movimento}
              onChange={(event) => {
                setMovimento(event.target.value as Movimento);
                setPagina(1);
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
                  setPagina(1);
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
                  setPagina(1);
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
              <select
                className={cn(field, "w-full min-w-0 flex-1 tab:w-auto")}
                aria-label="Sessão das selecionadas"
                value={sessaoLote}
                onChange={(event) => setSessaoLote(event.target.value)}
              >
                <option value="">Escolha a sessão</option>
                {sessoes.map((sessao) => (
                  <option key={sessao.id} value={sessao.id}>
                    {sessao.rotulo}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                disabled={ocupado !== "" || selecionadas === 0 || !sessaoLote}
                onClick={() => void lancarSelecionadas()}
              >
                {selecionadas > 0 ? `Lançar ${selecionadas}` : "Lançar selecionadas"}
              </Button>
            </div>
          ) : null}
          <ul className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface">
            {visiveis.length ? (
              visiveis.map((linha) => (
                <li key={`${linha.statementId}-${linha.line}`} className="grid grid-cols-[minmax(0,1fr)] gap-3 border-b border-line p-4 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {linha.link ? null : (
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
                      <span className="font-medium">{linha.description || "—"}</span>
                    </span>
                    <Money cents={linha.cents} strong />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-2">
                    <span>{dia(linha.date)}</span>
                    <span>{linha.accountName}</span>
                    <span>{linha.filename}</span>
                  </div>
                  {linha.link ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="ok">Cruzado</Chip>
                      <span className="text-sm">{textoDoVinculo(linha.link)}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
                      {linha.suggestion ? (
                        <Chip tone="ai" className="justify-self-start">
                          {linha.suggestionSource === "nome" ? "Proposta pelo nome" : "Proposta pelo valor"}
                        </Chip>
                      ) : (
                        <Chip className="justify-self-start">Sem lançamento</Chip>
                      )}
                      {linha.candidates.length ? (
                        <div className="grid grid-cols-[minmax(0,1fr)] gap-1">
                          <span className="text-sm text-ink-2">Lançamento do mês</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className={cn(field, "w-full min-w-0 flex-1 tab:w-auto")}
                              aria-label={`Lançamento para ${linha.description || "a linha"}`}
                              value={lancamentoDa(linha)}
                              onChange={(event) =>
                                setPar((atual) => ({ ...atual, [chaveDa(linha)]: event.target.value }))
                              }
                            >
                              <option value="">Escolha o lançamento</option>
                              {linha.candidates.map((candidato) => (
                                <option key={candidato.entryId} value={candidato.entryId}>
                                  {rotuloDoCandidato(candidato)}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="default"
                              disabled={ocupado !== "" || !lancamentoDa(linha)}
                              onClick={() => void confirmar(linha, lancamentoDa(linha))}
                            >
                              Confirmar
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {sessoes.length ? (
                        <div className="grid grid-cols-[minmax(0,1fr)] gap-1">
                          <span className="text-sm text-ink-2">
                            {linha.candidates.length ? "Ou lance numa sessão" : "Lance numa sessão"}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className={cn(field, "w-full min-w-0 flex-1 tab:w-auto")}
                              aria-label={`Sessão para ${linha.description || "a linha"}`}
                              value={sessaoDa(linha)}
                              onChange={(event) =>
                                setEscolha((atual) => ({ ...atual, [chaveDa(linha)]: event.target.value }))
                              }
                            >
                              <option value="">Escolha a sessão</option>
                              {sessoes.map((sessao) => (
                                <option key={sessao.id} value={sessao.id}>
                                  {sessao.rotulo}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="quiet"
                              disabled={ocupado !== "" || !sessaoDa(linha)}
                              onClick={() => void acumular(linha)}
                            >
                              Acumular
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-ink-2">Crie uma sessão em Grupos para lançar esta linha.</p>
                      )}
                    </div>
                  )}
                </li>
              ))
            ) : (
              <li className="px-6 py-6 text-center text-ink-2">
                {linhas.length
                  ? "Nenhuma linha com esses filtros."
                  : "Nenhuma linha lida neste mês. Importe um extrato em Importações."}
              </li>
            )}
          </ul>
          {filtradas.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-2">
                {inicio + 1}–{inicio + visiveis.length} de {filtradas.length}
              </p>
              <div className="flex gap-2">
                <Button variant="quiet" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>
                  Anterior
                </Button>
                <Button variant="quiet" disabled={paginaAtual >= paginas} onClick={() => setPagina(paginaAtual + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          ) : null}
          </div>
          <aside aria-label="IA" className="grid min-w-0 gap-4 rounded-lg border border-line bg-surface p-6 desk:max-w-sm">
            <h2 className="font-display text-lg">IA</h2>
            <p className="max-w-prose text-sm text-ink-2">
              A proposta usa o nome lembrado do extrato ou o mesmo valor perto do dia. Confirme para gravar o
              cruzamento e pagar a ocorrência do mês.
            </p>
            {propostas.length ? (
              <ul className="grid gap-4">
                {propostas.map((linha) => (
                  <li key={`${linha.statementId}-${linha.line}`} className="min-w-0">
                    <PendingAction title={linha.description || "—"}>
                      <p className="text-sm text-ink-2">{linha.suggestion ? textoDoVinculo(linha.suggestion) : ""}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="default"
                          disabled={ocupado !== ""}
                          onClick={() => void confirmar(linha, linha.suggestion?.entryId ?? "")}
                        >
                          Confirmar
                        </Button>
                      </div>
                    </PendingAction>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2">Nenhuma proposta neste mês.</p>
            )}
          </aside>
        </div>
      ) : null}
      </Troca>
    </>
  );
}
