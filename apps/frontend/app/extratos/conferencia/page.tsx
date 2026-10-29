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
import { Carregando } from "../../../components/ui/esqueleto";
import { Chip } from "../../../components/ui/chip";
import { campo, cn, focusRing } from "../../../components/ui/cn";
import { Segmentado } from "../../../components/ui/segmentado";
import { formatarReais, Money } from "../../../components/ui/money";
import { AnimatePresence, motion } from "motion/react";
import { Cascata, curvaSaida, ItemAnimado, ListaAnimada, Passo, Troca, useCurva } from "../../../components/ui/movimento";
import { PageHeader } from "../../../components/ui/page-header";
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

function rotuloDoCandidato(vinculo: NonNullable<LinhaConferencia["link"]>) {
  return `${tipoDaCategoria(vinculo.category)} · ${textoDoVinculo(vinculo)} · dia ${vinculo.day} · ${formatarReais(vinculo.cents)}`;
}

function pedeValorDoMes(candidato: NonNullable<LinhaConferencia["link"]>, cents: number) {
  return categoriaDeCompromisso(candidato.category) && candidato.cents !== cents;
}

function chaveDa(linha: LinhaConferencia) {
  return `${linha.statementId}:${linha.line}`;
}

export default function Conferencia() {
  const toast = useToast();
  const curva = useCurva();
  const hoje = new Date();
  const [year, setYear] = useState(hoje.getFullYear());
  const [month, setMonth] = useState(hoje.getMonth() + 1);
  const [deslize, setDeslize] = useState(0);
  const [dados, setDados] = useState<ConferenciaResposta | null>(null);
  const [falha, setFalha] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [buscando, setBuscando] = useState(false);
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

  // Recarrega sem apagar a lista: ela fica esmaecida até a resposta chegar, e a rolagem e os filtros se mantêm.
  function carregar(alvoAno: number, alvoMes: number) {
    setBuscando(true);
    setFalha("");
    return api<ConferenciaResposta>(`/api/extratos/conferencia?year=${alvoAno}&month=${alvoMes}`)
      .then((resposta) => {
        aplicado.current = `${resposta.year}-${resposta.month}`;
        setDados(resposta);
      })
      .catch((error: Error) => {
        setFalha(`${alvoAno}-${alvoMes}`);
        toast.erro(error.message);
      })
      .finally(() => setBuscando(false));
  }

  useEffect(() => {
    if (aplicado.current === pedido) return;
    let ativo = true;
    const abrir = manual.current ? "" : "&abrir=pendente";
    setBuscando(true);
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
        setDados(null);
        setFalha(pedido);
        toast.erro(error.message);
      })
      .finally(() => {
        if (ativo) setBuscando(false);
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
            .filter((sessao) => !sessao.endedAt && (sessao.kind !== "valor" || sessao.available))
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
      const resposta = await api<ConferenciaResposta>("/api/extratos/cruzamentos", {
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
      setDados(resposta);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível confirmar o cruzamento.");
    } finally {
      setOcupado("");
    }
  }

  async function desfazer(linha: LinhaConferencia) {
    setOcupado(chaveDa(linha));
    try {
      const resposta = await api<ConferenciaResposta>("/api/extratos/cruzamentos/desfazer", {
        method: "POST",
        body: JSON.stringify({ statementId: linha.statementId, line: linha.line }),
      });
      toast.sucesso("Cruzamento desfeito. A ocorrência voltou a pendente.");
      setDados(resposta);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível desfazer o cruzamento.");
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
      const resposta = await api<ConferenciaResposta>("/api/extratos/acumular", {
        method: "POST",
        body: JSON.stringify({ statementId: linha.statementId, line: linha.line, sessionId }),
      });
      toast.sucesso("Linha lançada na sessão. O nome fica lembrado para a próxima importação.");
      setPar({});
      setDados(resposta);
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
      {!dados && !falhou ? <Carregando texto="Carregando conferência." titulo linhas={5} /> : null}
      {dados ? (
        <motion.div
          className="grid min-w-0 gap-6"
          aria-busy={buscando}
          inert={buscando}
          animate={{ opacity: buscando ? 0.5 : 1 }}
          transition={curva}
        >
          {linhas.length ? (
            <p
              role="status"
              className={cn(
                "border px-4 py-3 text-sm",
                dados.checked
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-pending-line bg-pending-soft text-pending",
              )}
            >
              {dados.checked
                ? "Mês conferido. Toda linha do extrato tem lançamento."
                : `${dados.pending} ${dados.pending === 1 ? "linha ainda não tem" : "linhas ainda não têm"} lançamento. Cruze com um lançamento ou escolha uma sessão para lançar: o mês só fica conferido quando não sobrar nenhuma.`}
            </p>
          ) : null}
          {linhas.length ? (
            <Cascata className="grid min-w-0 gap-px border border-line bg-line desk:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <Passo className="grid content-between gap-6 bg-surface p-6">
                <div className="grid gap-2">
                  <span className="etiqueta text-ink-2">Sobra do mês</span>
                  <span className="font-display text-2xl font-bold tracking-titulo">
                    <Money cents={entradas + saidas} />
                  </span>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="etiqueta text-ink-2">Conferido</span>
                    <span className="etiqueta">
                      {cruzadas} de {linhas.length}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden bg-line">
                    <motion.div
                      className="h-full origin-left bg-brand"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: cruzadas / linhas.length }}
                      transition={{ ...curva, duration: 0.8 }}
                    />
                  </div>
                </div>
              </Passo>
              <dl className="grid grid-cols-2 gap-px bg-line tab:grid-cols-3" aria-label="Resumo do extrato">
                <Celula label="Entradas">
                  <Money cents={entradas} />
                </Celula>
                <Celula label="Saídas">
                  <Money cents={saidas} />
                </Celula>
                <Celula label="Sem lançamento">{dados.pending}</Celula>
                <Celula label="Com sessão">{alteradas}</Celula>
                <Celula label="Cruzadas">{cruzadas}</Celula>
                <Celula label="Linhas">{linhas.length}</Celula>
              </dl>
            </Cascata>
          ) : null}
          <div className="grid min-w-0 gap-3 border border-line bg-surface p-4">
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
          </div>
          {abertasFiltradas.length ? (
            <motion.div
              layout
              className="sticky top-2 z-10 flex flex-wrap items-center gap-2 border border-line bg-surface p-3 tab:top-4"
            >
              <label className="etiqueta flex min-h-10 items-center gap-2">
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
              <span className="flex flex-wrap items-center gap-2 tab:ml-auto">
                <Button
                  variant="primary"
                  carregando={ocupado === "lote"}
                  disabled={ocupado !== "" || selecionadas === 0}
                  onClick={() => void lancarSelecionadas()}
                >
                  {ocupado === "lote" ? "Lançando" : selecionadas > 0 ? `Lançar ${selecionadas}` : "Lançar selecionadas"}
                </Button>
                <Button
                  carregando={ocupado === "lote"}
                  disabled={ocupado !== "" || alteradas === 0}
                  onClick={() => void lancarAlteradas()}
                >
                  {ocupado === "lote" ? "Lançando" : alteradas > 0 ? `Lançar ${alteradas} alteradas` : "Lançar alteradas"}
                </Button>
              </span>
            </motion.div>
          ) : null}
          {dias.length ? (
            <div className="grid min-w-0 gap-8">
              {dias.map((grupo) => {
                const [, mesDoDia, numeroDoDia] = grupo.data.split("-");
                const entradasDia = grupo.itens.reduce((soma, linha) => soma + (linha.cents > 0 ? linha.cents : 0), 0);
                const saidasDia = grupo.itens.reduce((soma, linha) => soma + (linha.cents < 0 ? linha.cents : 0), 0);
                return (
                  <section
                    key={grupo.data}
                    aria-label={dia(grupo.data)}
                    className="flex min-w-0 flex-col gap-3 tab:flex-row tab:gap-6"
                  >
                    <header className="flex items-baseline gap-3 tab:sticky tab:top-12 tab:w-12 tab:shrink-0 tab:flex-col tab:gap-1 tab:self-start">
                      <span className="font-display text-xl font-bold tracking-titulo">{numeroDoDia}</span>
                      <span className="etiqueta text-ink-2">{meses[Number(mesDoDia) - 1]?.slice(0, 3)}</span>
                      <span className="etiqueta ml-auto flex gap-2 text-ink-2 tab:hidden">
                        {grupo.itens.length === 1 ? "1 linha" : `${grupo.itens.length} linhas`}
                        <Money cents={entradasDia + saidasDia} />
                      </span>
                    </header>
                    <ListaAnimada className="grid min-w-0 flex-1 gap-2">
                      <AnimatePresence initial={false}>
                        {grupo.itens.map((linha) => {
                          const chave = chaveDa(linha);
                          const marcada = marcadas[chave] === true && !linha.link;
                          const lateral = linha.link
                            ? "border-l-pos"
                            : linha.suggestion
                              ? "border-l-pending-line"
                              : "border-l-line";
                          return (
                            <ItemAnimado
                              key={`${linha.statementId}-${linha.line}`}
                              layout="position"
                              exit={{ opacity: 0, transition: curvaSaida }}
                              whileHover={{ x: 2 }}
                              className={cn(
                                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border border-l-4 border-line px-4 py-3",
                                lateral,
                                marcada ? "bg-brand-soft" : "bg-surface",
                              )}
                            >
                              {linha.link ? (
                                <span className="size-4" />
                              ) : (
                                <input
                                  type="checkbox"
                                  className={caixa}
                                  aria-label={`Selecionar ${linha.description || "a linha"}`}
                                  checked={marcada}
                                  onChange={(event) =>
                                    setMarcadas((atual) => ({ ...atual, [chave]: event.target.checked }))
                                  }
                                />
                              )}
                              <span className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="min-w-0 font-display font-bold tracking-titulo">
                                  {linha.description || "—"}
                                </span>
                                {linha.link ? <Chip tone="ok">Cruzado</Chip> : null}
                                {!linha.link && linha.suggestion ? (
                                  <Chip tone="ai">{linha.suggestionSource === "nome" ? "Nome" : "Valor"}</Chip>
                                ) : null}
                                {!linha.link && linha.sessionSource === "compromisso" ? (
                                  <Chip tone="ai">Compromisso: {linha.appointmentTitle}</Chip>
                                ) : null}
                                {contas.length > 1 ? <span className="etiqueta text-ink-2">{linha.accountName}</span> : null}
                                {arquivos.length > 1 ? <span className="etiqueta text-ink-2">{linha.filename}</span> : null}
                              </span>
                              <span className="font-display text-lg font-bold tracking-titulo">
                                <Money cents={linha.cents} />
                              </span>
                              {linha.link ? (
                                <span className="col-start-2 row-start-2 min-w-0 text-sm text-ink-2">
                                  {textoDoVinculo(linha.link)}
                                </span>
                              ) : sessoes.length ? (
                                <BuscaSessao
                                  className="col-start-2 row-start-2 min-w-0"
                                  sessoes={sessoes}
                                  valor={sessaoDa(linha)}
                                  rotulo={`Sessão para ${linha.description || "a linha"}`}
                                  onEscolher={(id) => setEscolha((atual) => ({ ...atual, [chave]: id }))}
                                />
                              ) : (
                                <span className="col-start-2 row-start-2 text-sm text-ink-2">Crie uma sessão em Grupos.</span>
                              )}
                              {linha.link ? (
                                <Button
                                  className="col-start-3 row-start-2"
                                  variant="quiet"
                                  carregando={ocupado === chave}
                                  disabled={ocupado !== ""}
                                  onClick={() => void desfazer(linha)}
                                >
                                  {ocupado === chave ? "Desfazendo" : "Desfazer"}
                                </Button>
                              ) : (
                                <Button
                                  className="col-start-3 row-start-2"
                                  variant="quiet"
                                  carregando={ocupado === chave}
                                  disabled={ocupado !== "" || !sessaoDa(linha)}
                                  onClick={() => void acumular(linha)}
                                >
                                  {ocupado === chave ? "Lançando" : "Acumular"}
                                </Button>
                              )}
                              {!linha.link && linha.candidates.length ? (
                                <div className="col-span-2 col-start-2 row-start-3 flex flex-wrap items-center gap-2">
                                  <select
                                    className={cn(field, "w-full min-w-0 flex-1 desk:w-auto")}
                                    aria-label={`Lançamento para ${linha.description || "a linha"}`}
                                    value={lancamentoDa(linha)}
                                    onChange={(event) => {
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
                                    const escolhido = valorMes[chave] || "";
                                    return (
                                      <motion.span
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={curva}
                                        className="flex w-full flex-wrap items-center gap-2 border border-pending-line bg-pending-soft p-3"
                                      >
                                        <span className="text-sm text-pending">Os valores divergem. Qual vale neste mês?</span>
                                        <Segmentado<"" | ValorDoMes>
                                          aria-label="Valor deste mês"
                                          opcoes={[
                                            { id: "extrato", label: `Extrato ${formatarReais(linha.cents)}` },
                                            { id: "lancamento", label: `Lançamento ${formatarReais(candidato.cents)}` },
                                          ]}
                                          valor={escolhido}
                                          onEscolher={(id) => {
                                            if (!id) return;
                                            setValorMes((atual) => ({ ...atual, [chave]: id }));
                                          }}
                                        />
                                      </motion.span>
                                    );
                                  })()}
                                  <Button
                                    variant="default"
                                    carregando={ocupado === chave}
                                    disabled={
                                      ocupado !== "" ||
                                      !lancamentoDa(linha) ||
                                      linha.candidates.some(
                                        (item) =>
                                          item.entryId === lancamentoDa(linha) &&
                                          pedeValorDoMes(item, linha.cents) &&
                                          !valorMes[chave],
                                      )
                                    }
                                    onClick={() => void confirmar(linha, lancamentoDa(linha))}
                                  >
                                    {ocupado === chave ? "Cruzando" : "Confirmar"}
                                  </Button>
                                </div>
                              ) : null}
                            </ItemAnimado>
                          );
                        })}
                      </AnimatePresence>
                    </ListaAnimada>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="border border-line bg-surface px-6 py-8 text-center text-ink-2">
              {linhas.length
                ? "Nenhuma linha com esses filtros."
                : "Nenhuma linha lida neste mês. Importe um extrato em Importações."}
            </p>
          )}
        </motion.div>
      ) : null}
      </Troca>
    </>
  );
}

function Celula({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Passo className="grid content-between gap-2 bg-surface p-4">
      <dt className="etiqueta text-ink-2">{label}</dt>
      <dd className="font-display text-lg font-bold tracking-titulo">{children}</dd>
    </Passo>
  );
}
