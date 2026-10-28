"use client";

import { useEffect, useState } from "react";
import {
  CALENDARIO_NACIONAL,
  CATEGORIAS_TRANSACAO,
  MODOS_TRANSACAO,
  PADROES_DE_VENCIMENTO_INICIAIS,
  PRIORIDADES_TRANSACAO,
  RECORRENCIAS,
  REGRA_SEM_AJUSTE,
  STATUS_TRANSACAO,
  TIPOS_TRANSACAO,
  aceitaRegraDeVencimento,
  criarCalendario,
  regraPadrao,
  type CalendarioDeDiasUteis,
  type CategoriaTransacao,
  type Configuracoes,
  type FeriadoLocal,
  type FinancasVista,
  type GruposResposta,
  type LancamentoVista,
  type ModoTransacao,
  type PrioridadeTransacao,
  type PadroesDeVencimento,
  type Recorrencia,
  type RegraCategoria,
  type RegraDeVencimento,
  type StatusTransacao,
  type TipoTransacao,
  type Workflow,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Carregando } from "../../components/ui/esqueleto";
import { Segmentado } from "../../components/ui/segmentado";
import { Dialogo } from "../../components/ui/dialogo";
import { Chip } from "../../components/ui/chip";
import { Money } from "../../components/ui/money";
import { Troca } from "../../components/ui/movimento";
import { PageHeader } from "../../components/ui/page-header";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { campo, cn } from "../../components/ui/cn";
import { AcoesTransacao, ControleExclusao } from "./acoes";
import { OcorrenciasDoLancamento } from "./ocorrencias";
import { TabelaLancamentos } from "./tabela";
import { ViradaDoAno } from "./virada";
import { VisaoGeral } from "./visao-geral";
import { api } from "./api";
import { CampoValor } from "./campo-valor";
import { RegraDoVencimento } from "./regra-do-vencimento";
import { centavosParaReais, doisDigitos, reaisParaCentavos } from "./reais";
import {
  ROTULO_CATEGORIA,
  ROTULO_MODO,
  ROTULO_PRIORIDADE,
  ROTULO_RECORRENCIA,
  ROTULO_STATUS,
  ROTULO_TIPO,
  unidadeDaRecorrencia,
} from "./rotulos";

type Visao = "base" | "geral";
type SessaoOpcao = GruposResposta["sessions"][number] & { groupName: string };
type Rascunho = {
  id: string;
  sessionId: string;
  name: string;
  description: string;
  justification: string;
  date: string;
  mode: ModoTransacao;
  status: StatusTransacao;
  transactionType: TipoTransacao;
  category: CategoriaTransacao;
  priority: PrioridadeTransacao;
  amount: string;
  installments: string;
  installmentNumber: string;
  dueDate: string;
  interestRate: string;
  nextDueDate: string;
  recurrence: Recorrencia;
  recurrenceInterval: string;
  commitmentId: string;
  dueRule: RegraDeVencimento;
  /** false: a regra segue o padrão das configurações enquanto a pessoa não mexer. */
  dueRuleManual: boolean;
};

const field = cn(campo, "w-full");

export default function Financas() {
  const toast = useToast();
  const [data, setData] = useState<FinancasVista | null>(null);
  const [versao, setVersao] = useState(0);
  const [ready, setReady] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [visao, setVisao] = useState<Visao>("geral");
  const [deslize, setDeslize] = useState(0);
  const [year, setYear] = useState<number | null>(null);
  const [draft, setDraft] = useState<Rascunho | null>(null);
  const [foco, setFoco] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessaoOpcao[]>([]);
  const [saving, setSaving] = useState(false);
  const [vencimentos, setVencimentos] = useState<PadroesDeVencimento>(PADROES_DE_VENCIMENTO_INICIAIS);
  const [calendario, setCalendario] = useState<CalendarioDeDiasUteis>(CALENDARIO_NACIONAL);

  function carregar() {
    return api<FinancasVista>("/api/financas")
      .then((resposta) => {
        setData(resposta);
        setVersao((atual) => atual + 1);
        setFalhou(false);
        return resposta;
      })
      .catch((error: Error) => {
        setFalhou(true);
        toast.erro(error.message);
        return null;
      });
  }

  useEffect(() => {
    let active = true;
    api<FinancasVista>("/api/financas")
      .then((resposta) => {
        if (!active) return;
        setData(resposta);
      })
      .catch((error: Error) => {
        if (!active) return;
        setFalhou(true);
        toast.erro(error.message);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const workflow = data?.workflow;
  const ano = year ?? workflow?.year ?? 2026;
  const regra = draft && data ? data.rules[draft.category] : null;
  const vista = draft && regra
    ? {
        mode: regra.mode ?? draft.mode,
        transactionType: regra.transactionType ?? draft.transactionType,
      }
    : null;
  const comPrioridade = Boolean(
    regra && vista && (regra.priority === "sempre" || (regra.priority === "saida" && vista.mode === "outflows")),
  );
  const editando = Boolean(draft && data?.entries.some((entry) => entry.id === draft.id));
  const entrada = editando ? (data?.entries.find((entry) => entry.id === draft?.id) ?? null) : null;
  const travado = entrada?.termsLocked ?? false;
  const padraoDoVencimento = draft && vista ? regraPadrao(vencimentos, draft.category, vista.mode) : REGRA_SEM_AJUSTE;
  const regraDoVencimento = draft?.dueRuleManual ? draft.dueRule : padraoDoVencimento;

  // Os padrões de vencimento e os feriados da conta deixam a prévia igual ao que o backend grava.
  // Se falharem, a prévia usa os padrões iniciais e os feriados nacionais, e o backend continua mandando.
  async function prepararVencimento() {
    const [config, feriados] = await Promise.all([
      api<Configuracoes>("/api/configuracoes").catch(() => null),
      api<{ locais: FeriadoLocal[] }>("/api/feriados").catch(() => null),
    ]);
    if (config?.vencimentos) setVencimentos(config.vencimentos);
    if (feriados) setCalendario(criarCalendario(feriados.locais));
  }

  async function excluir(entry: LancamentoVista) {
    try {
      await api(`/api/lancamentos/${entry.id}`, { method: "DELETE" });
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível apagar o lançamento.");
      throw error;
    }
    toast.sucesso("Lançamento apagado.");
    if (draft?.id === entry.id) setDraft(null);
    await carregar();
  }

  function abrirPorId(entryId: string, numero: number) {
    const entry = data?.entries.find((item) => item.id === entryId);
    if (entry) void abrirEdicao(entry, numero);
  }

  async function abrirEdicao(entry: LancamentoVista, numero?: number) {
    try {
      const [opcoes] = await Promise.all([sessoesAbertas(), prepararVencimento()]);
      if (!opcoes.some((session) => session.id === entry.sessionId)) {
        opcoes.unshift({
          id: entry.sessionId,
          groupId: entry.groupId,
          name: entry.sessionName,
          description: "",
          justification: "",
          startedAt: null,
          endedAt: null,
          kind: "acumulo",
          categories: [...CATEGORIAS_TRANSACAO],
          available: true,
          cents: 0,
          additions: [],
          totalCents: 0,
          groupName: entry.groupName,
        });
      }
      setSessions(opcoes);
      setFoco(numero ?? null);
      setDraft(rascunhoDe(entry));
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  async function sessoesAbertas() {
    const grupos = await api<GruposResposta>("/api/grupos");
    return grupos.sessions.filter((session) => !session.endedAt).map((session) => ({
      ...session,
      groupName: grupos.groups.find((group) => group.id === session.groupId)?.name ?? "",
    }));
  }

  async function abrirLancamento() {
    try {
      const [abertas] = await Promise.all([sessoesAbertas(), prepararVencimento()]);
      const opcoes = abertas.filter((session) => session.available);
      if (opcoes.length === 0) {
        toast.alerta(
          abertas.length === 0
            ? "Crie um grupo e uma sessão antes do lançamento."
            : "As sessões de valor único já foram lançadas.",
        );
        return;
      }
      const inicio = workflow ?? { year: ano, month: 3, day: 1 };
      const date = dataIso(inicio.year, inicio.month, inicio.day);
      setSessions(opcoes);
      setDraft({
        id: crypto.randomUUID(),
        sessionId: opcoes[0]?.id ?? "",
        name: "",
        description: "",
        justification: "",
        date,
        mode: "outflows",
        status: "pending",
        transactionType: "unusual",
        category: categoriaDaSessao(opcoes[0]?.categories),
        priority: "normal",
        amount: "",
        installments: "2",
        installmentNumber: "1",
        dueDate: date,
        interestRate: "",
        nextDueDate: date,
        recurrence: "monthly",
        recurrenceInterval: "1",
        commitmentId: "",
        dueRule: REGRA_SEM_AJUSTE,
        dueRuleManual: false,
      });
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    const absoluto = reaisParaCentavos(draft.amount.replace(/^[-−]/, ""));
    if (absoluto == null) {
      toast.erro("Informe o valor.");
      return;
    }
    setSaving(true);
    let gravou = false;
    try {
      await api(editando ? `/api/lancamentos/${draft.id}` : "/api/lancamentos", {
        method: editando ? "PATCH" : "POST",
        body: JSON.stringify({
          id: draft.id,
          sessionId: draft.sessionId,
          name: draft.name.trim(),
          description: draft.description.trim(),
          justification: draft.justification.trim(),
          date: draft.date,
          mode: draft.mode,
          status: draft.status,
          transactionType: draft.transactionType,
          category: draft.category,
          priority: draft.priority,
          cents: Math.abs(absoluto),
          installments: numeroDoCampo(draft.installments),
          installmentNumber: numeroDoCampo(draft.installmentNumber),
          dueDate: draft.dueDate || null,
          interestRate: numeroDoCampo(draft.interestRate.replace(",", ".")),
          nextDueDate: draft.nextDueDate || null,
          recurrence: draft.recurrence,
          recurrenceInterval: numeroDoCampo(draft.recurrenceInterval),
          // Sem escolha da pessoa, vai null e o backend aplica o padrão atual das configurações.
          dueRule:
            aceitaRegraDeVencimento(draft.category) && (draft.dueRuleManual || editando) ? regraDoVencimento : null,
        }),
      });
      gravou = true;
      if (editando && entrada) {
        if (draft.status !== entrada.status) {
          await api(`/api/lancamentos/${draft.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: draft.status }),
          });
        }
        if (draft.commitmentId && draft.commitmentId !== (entrada.commitmentId ?? "")) {
          await api(`/api/lancamentos/${draft.id}/compromisso`, {
            method: "POST",
            body: JSON.stringify({ commitmentId: draft.commitmentId }),
          });
        }
      }
      setDraft(null);
      toast.sucesso(editando ? "Lançamento atualizado." : "Lançamento criado.");
      await carregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar o lançamento.");
      if (gravou && editando) {
        const resposta = await carregar();
        const atual = resposta?.entries.find((item) => item.id === draft.id);
        if (atual) setDraft(rascunhoDe(atual));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0">
      <ViradaDoAno />
      <PageHeader
        title="Finanças"
        subtitle={workflow ? subtitulo(workflow) : undefined}
        actions={
          <>
            <Segmentado
              aria-label="Visão"
              opcoes={[
                { id: "base", label: "Base" },
                { id: "geral", label: "Geral" },
              ]}
              valor={visao}
              onEscolher={(id, direcao) => {
                setDeslize(direcao);
                setVisao(id);
              }}
            />
            <Button variant="primary" onClick={abrirLancamento}>
              Novo lançamento
            </Button>
          </>
        }
      >
        <div className="grid min-w-0 gap-4">
          {!ready && !falhou ? (
            <Carregando texto="Carregando finanças." titulo linhas={5} />
          ) : null}
          {ready && workflow && data ? (
            <Troca id={`${visao}-${ano}`} direcao={deslize} className="grid min-w-0 gap-4">
              {visao === "geral" ? (
                <>
                  <Ano
                    year={ano}
                    workflow={workflow}
                    onPrevious={() => {
                      setDeslize(-1);
                      setYear(ano - 1);
                    }}
                    onNext={() => {
                      setDeslize(1);
                      setYear(ano + 1);
                    }}
                  />
                  <VisaoGeral year={ano} versao={versao} />
                </>
              ) : (
                <TabelaLancamentos
                  year={ano}
                  versao={versao}
                  onEditar={abrirPorId}
                  onAtualizar={async () => {
                    await carregar();
                  }}
                />
              )}
            </Troca>
          ) : null}
        </div>
        <Dialogo
          aberto={draft !== null}
          largura={entrada ? "larga" : undefined}
          onClose={() => setDraft(null)}
        >
          <h2 className="mb-4 font-display text-lg">{editando ? "Editar lançamento" : "Novo lançamento"}</h2>
          <form onSubmit={salvar}>
            <div className="dialog-corpo grid gap-4">
            <div className="grid gap-1">
              <Rotulo htmlFor="lancamento-sessao" dica="Onde este lançamento entra. A sessão pertence a um grupo.">
                Sessão
              </Rotulo>
              <select
                id="lancamento-sessao"
                value={draft?.sessionId ?? ""}
                onChange={(event) =>
                  setDraft((current) => {
                    if (!current) return current;
                    const escolhida = sessions.find((session) => session.id === event.target.value);
                    return {
                      ...current,
                      sessionId: event.target.value,
                      category: editando
                        ? current.category
                        : categoriaDaSessao(escolhida?.categories, current.category),
                    };
                  })
                }
                className={field}
              >
                {sessions
                  .filter((session) => session.available || session.id === draft?.sessionId)
                  .map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.groupName} · {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Rotulo htmlFor="lancamento-nome" dica="Como este lançamento aparece na lista.">
                Nome
              </Rotulo>
              <input
                id="lancamento-nome"
                value={draft?.name ?? ""}
                maxLength={160}
                onChange={(event) =>
                  setDraft((current) => (current ? { ...current, name: event.target.value } : current))
                }
                className={field}
              />
            </div>
            <div className="grid gap-1">
              <Rotulo htmlFor="lancamento-descricao" dica="Um detalhe a mais sobre este lançamento.">
                Descrição
              </Rotulo>
              <textarea
                id="lancamento-descricao"
                value={draft?.description ?? ""}
                maxLength={160}
                rows={2}
                placeholder="Opcional"
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
                className={cn(field, "resize-y py-2")}
              />
            </div>
            <div className="grid gap-1">
              <Rotulo htmlFor="lancamento-justificativa" dica="Por que este valor existe.">
                Justificativa
              </Rotulo>
              <textarea
                id="lancamento-justificativa"
                value={draft?.justification ?? ""}
                maxLength={160}
                rows={2}
                placeholder="Opcional"
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, justification: event.target.value } : current,
                  )
                }
                className={cn(field, "resize-y py-2")}
              />
            </div>
            {editando && travado && draft && entrada ? (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                <time dateTime={draft.date}>{dataBr(draft.date)}</time>
                <Money cents={entrada.contractCents} />
              </p>
            ) : (
            <div className="dialog-par">
              <div className="grid gap-1">
                <Rotulo htmlFor="lancamento-data" dica="O dia deste lançamento.">
                  Data
                </Rotulo>
                <input
                  id="lancamento-data"
                  type="date"
                  value={draft?.date ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, date: event.target.value } : current,
                    )
                  }
                  className={field}
                />
              </div>
              <div className="grid gap-1">
                <Rotulo htmlFor="lancamento-valor" dica="O valor em reais. Os centavos entram enquanto você digita.">
                  Valor
                </Rotulo>
                <CampoValor
                  id="lancamento-valor"
                  value={(draft?.amount ?? "").replace(/^[-−+]/, "")}
                  onChange={(valor) =>
                    setDraft((current) => (current ? { ...current, amount: valor } : current))
                  }
                  className={field}
                />
              </div>
            </div>
            )}
            {editando && vista && regra && draft ? (
              <p className="text-sm text-ink-2">{resumoDaBase(draft, vista, regra)}</p>
            ) : null}
            {editando ? null : (
              <div className="dialog-par">
                <CampoSelect
                  id="lancamento-categoria"
                  label="Categoria"
                  dica="Os tipos que esta sessão aceita."
                  value={draft?.category ?? "fixed"}
                  options={(sessions.find((session) => session.id === draft?.sessionId)?.categories ??
                    CATEGORIAS_TRANSACAO
                  ).map((item) => ({
                    value: item,
                    label: ROTULO_CATEGORIA[item],
                  }))}
                  onChange={(category) =>
                    setDraft((current) =>
                      current ? { ...current, category: category as CategoriaTransacao } : current,
                    )
                  }
                />
                {vista && regra?.mode === null ? (
                  <CampoSelect
                    id="lancamento-movimento"
                    label="Movimento"
                    dica="Entrada ou saída. Algumas categorias já definem isso."
                    value={vista.mode}
                    options={MODOS_TRANSACAO.map((item) => ({ value: item, label: ROTULO_MODO[item] }))}
                    onChange={(mode) =>
                      setDraft((current) =>
                        current ? { ...current, mode: mode as ModoTransacao } : current,
                      )
                    }
                  />
                ) : null}
                {vista && regra?.transactionType === null ? (
                  <CampoSelect
                    id="lancamento-tipo"
                    label="Tipo"
                    dica="Compromisso combinado ou um lançamento incomum."
                    value={vista.transactionType}
                    options={TIPOS_TRANSACAO.map((item) => ({ value: item, label: ROTULO_TIPO[item] }))}
                    onChange={(transactionType) =>
                      setDraft((current) =>
                        current
                          ? { ...current, transactionType: transactionType as TipoTransacao }
                          : current,
                      )
                    }
                  />
                ) : null}
              </div>
            )}
            <div className="dialog-par">
              {editando ? null : (
              <CampoSelect
                id="lancamento-status"
                label="Status"
                dica="Pendente, paga, cancelada ou estornada."
                value={draft?.status ?? "pending"}
                options={STATUS_TRANSACAO.map((item) => ({ value: item, label: ROTULO_STATUS[item] }))}
                onChange={(status) =>
                  setDraft((current) =>
                    current ? { ...current, status: status as StatusTransacao } : current,
                  )
                }
              />
              )}
              {draft && comPrioridade ? (
                <CampoSelect
                  id="lancamento-prioridade"
                  label="Prioridade"
                  dica="Baixa, normal ou alta. Só aparece quando a categoria permite."
                  value={draft.priority === "nopriority" ? "normal" : draft.priority}
                  options={PRIORIDADES_TRANSACAO.filter((item) => item !== "nopriority").map((item) => ({
                    value: item,
                    label: ROTULO_PRIORIDADE[item],
                  }))}
                  onChange={(priority) =>
                    setDraft((current) =>
                      current ? { ...current, priority: priority as PrioridadeTransacao } : current,
                    )
                  }
                />
              ) : null}
            </div>
            {draft && regra?.installments && (!editando || !travado) ? (
              <div className="dialog-par">
                {editando ? null : (
                <div className="grid gap-1">
                  <Rotulo htmlFor="lancamento-parcela" dica="Qual parcela está em andamento.">
                    Parcela atual
                  </Rotulo>
                  <input
                    id="lancamento-parcela"
                    inputMode="numeric"
                    value={draft.installmentNumber}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, installmentNumber: event.target.value } : current,
                      )
                    }
                    className={field}
                  />
                </div>
                )}
                {editando && travado ? null : (
                  <div className="grid gap-1">
                    <Rotulo htmlFor="lancamento-parcelas" dica="Quantas parcelas este lançamento tem.">
                      Total de parcelas
                    </Rotulo>
                    <input
                      id="lancamento-parcelas"
                      inputMode="numeric"
                      value={draft.installments}
                      onChange={(event) =>
                        setDraft((current) =>
                          current ? { ...current, installments: event.target.value } : current,
                        )
                      }
                      className={field}
                    />
                  </div>
                )}
              </div>
            ) : null}
            {draft && regra?.loan && (!editando || !travado) ? (
              <div className="dialog-par">
                <div className="grid gap-1">
                  <Rotulo htmlFor="lancamento-vencimento" dica="O dia em que o empréstimo vence.">
                    Vencimento
                  </Rotulo>
                  <input
                    id="lancamento-vencimento"
                    type="date"
                    value={draft.dueDate}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, dueDate: event.target.value } : current,
                      )
                    }
                    className={field}
                  />
                </div>
                <div className="grid gap-1">
                  <Rotulo htmlFor="lancamento-juros" dica="A taxa de juros do empréstimo.">
                    Juros (%)
                  </Rotulo>
                  <input
                    id="lancamento-juros"
                    inputMode="decimal"
                    value={draft.interestRate}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, interestRate: event.target.value } : current,
                      )
                    }
                    className={field}
                  />
                </div>
              </div>
            ) : null}
            {draft && regra?.recurrence ? (
              <div className="grid gap-4">
                {!editando || !travado ? (
                  <div className="dialog-par">
                    <CampoSelect
                      id="lancamento-recorrencia"
                      label="Recorrência"
                      dica="De quanto em quanto o valor fixo se repete neste ano."
                      value={draft.recurrence}
                      options={RECORRENCIAS.map((item) => ({
                        value: item,
                        label: ROTULO_RECORRENCIA[item],
                      }))}
                      onChange={(recurrence) =>
                        setDraft((current) =>
                          current ? { ...current, recurrence: recurrence as Recorrencia } : current,
                        )
                      }
                    />
                    <div className="grid gap-1">
                      <Rotulo
                        htmlFor="lancamento-intervalo"
                        dica="Quantos períodos separam uma ocorrência da outra."
                      >
                        Intervalo em {unidadeDaRecorrencia(draft.recurrence)}
                      </Rotulo>
                      <input
                        id="lancamento-intervalo"
                        inputMode="numeric"
                        value={draft.recurrenceInterval}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, recurrenceInterval: event.target.value } : current,
                          )
                        }
                        className={field}
                      />
                    </div>
                  </div>
                ) : null}
                {editando ? null : (
                <div className="grid gap-1">
                  <Rotulo htmlFor="lancamento-proximo" dica="A próxima data em que o valor fixo acontece.">
                    Próximo vencimento
                  </Rotulo>
                  <input
                    id="lancamento-proximo"
                    type="date"
                    value={draft.nextDueDate}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, nextDueDate: event.target.value } : current,
                      )
                    }
                    className={field}
                  />
                </div>
                )}
              </div>
            ) : null}
            {draft && vista && aceitaRegraDeVencimento(draft.category) ? (
              <RegraDoVencimento
                category={draft.category}
                recurrence={draft.category === "fixed" ? draft.recurrence : null}
                recurrenceInterval={numeroDoCampo(draft.recurrenceInterval)}
                installments={numeroDoCampo(draft.installments)}
                date={draft.date}
                regra={regraDoVencimento}
                padrao={padraoDoVencimento}
                editando={editando}
                calendario={calendario}
                onChange={(dueRule, dueRuleManual) =>
                  setDraft((current) => (current ? { ...current, dueRule, dueRuleManual } : current))
                }
              />
            ) : null}
            {entrada ? (
              <OcorrenciasDoLancamento
                entry={entrada}
                foco={foco}
                onAtualizar={async () => {
                  const resposta = await carregar();
                  const atual = resposta?.entries.find((item) => item.id === entrada.id);
                  if (atual) setDraft(rascunhoDe(atual));
                }}
              />
            ) : null}
            {entrada ? (
              <AcoesTransacao
                embutido
                entry={entrada}
                entries={data?.entries ?? []}
                year={entrada.startYear}
                month={entrada.startMonth}
                status={draft?.status}
                commitmentId={draft?.commitmentId ?? ""}
                onStatus={(status) =>
                  setDraft((current) => (current ? { ...current, status } : current))
                }
                onCommitment={(commitmentId) =>
                  setDraft((current) => (current ? { ...current, commitmentId } : current))
                }
                onClose={() => setDraft(null)}
                onAtualizar={async () => {
                  const resposta = await carregar();
                  const atual = resposta?.entries.find((item) => item.id === entrada.id);
                  if (atual) setDraft(rascunhoDe(atual));
                }}
              />
            ) : null}
            </div>
            <div className="dialog-acoes">
              {entrada ? (
                <div className="mr-auto">
                  <ControleExclusao removivel={entrada.actions.remove} onExcluir={() => excluir(entrada)} />
                </div>
              ) : null}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setDraft(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                {editando ? "Salvar" : "Criar lançamento"}
              </Button>
            </div>
          </form>
        </Dialogo>
      </PageHeader>
    </div>
  );
}

function Ano({
  year,
  workflow,
  onPrevious,
  onNext,
}: {
  year: number;
  workflow: Workflow;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex items-center gap-1 font-semibold">
        <Button
          variant="quiet"
          className="size-10 px-0 disabled:opacity-60"
          aria-label="Ano anterior"
          disabled={year <= workflow.year}
          onClick={onPrevious}
        >
          ‹
        </Button>
        <span>{year}</span>
        <Button variant="quiet" className="size-10 px-0" aria-label="Próximo ano" onClick={onNext}>
          ›
        </Button>
      </div>
      <Chip>
        A partir de {doisDigitos(workflow.day)}/{doisDigitos(workflow.month)}
      </Chip>
    </div>
  );
}

function subtitulo(workflow: Workflow) {
  return `Workflow de ${workflow.year} · iniciado em ${doisDigitos(workflow.day)}/${doisDigitos(workflow.month)}`;
}

function numeroDoCampo(texto: string) {
  if (texto.trim() === "") return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function rascunhoDe(entry: LancamentoVista): Rascunho {
  const valor = entry.contractCents;
  return {
    id: entry.id,
    sessionId: entry.sessionId,
    name: entry.name,
    description: entry.description,
    justification: entry.justification,
    date: entry.date,
    mode: entry.mode,
    status: entry.status,
    transactionType: entry.transactionType,
    category: entry.category,
    priority: entry.priority,
    amount: centavosParaReais(Math.abs(valor)),
    installments: String(entry.installments ?? 2),
    installmentNumber: String(entry.installmentNumber ?? 1),
    dueDate: entry.dueDate ?? entry.date,
    interestRate: entry.interestRate == null ? "" : String(entry.interestRate).replace(".", ","),
    nextDueDate: entry.nextDueDate ?? entry.date,
    recurrence: entry.recurrence ?? "monthly",
    recurrenceInterval: String(entry.recurrenceInterval ?? 1),
    commitmentId: entry.commitmentId ?? "",
    dueRule: entry.dueRule ?? REGRA_SEM_AJUSTE,
    dueRuleManual: true,
  };
}

function categoriaDaSessao(
  categories: CategoriaTransacao[] | undefined,
  atual?: CategoriaTransacao,
): CategoriaTransacao {
  if (atual && categories?.includes(atual)) return atual;
  if (categories?.includes("fixed")) return "fixed";
  return categories?.[0] ?? "unique";
}

function dataIso(year: number, month: number, day: number) {
  return `${year}-${doisDigitos(month)}-${doisDigitos(Math.min(Math.max(day, 1), 28))}`;
}

function resumoDaBase(
  draft: Rascunho,
  vista: { mode: ModoTransacao; transactionType: TipoTransacao },
  regra: RegraCategoria,
) {
  const partes = [
    ROTULO_CATEGORIA[draft.category],
    ROTULO_MODO[vista.mode],
    ROTULO_TIPO[vista.transactionType],
  ];
  if (regra.recurrence) {
    partes.push(
      `${ROTULO_RECORRENCIA[draft.recurrence]}, a cada ${draft.recurrenceInterval} ${unidadeDaRecorrencia(draft.recurrence)}`,
    );
  }
  if (regra.installments) {
    partes.push(`${draft.installments} parcelas`);
  }
  if (regra.loan) {
    partes.push(`vence em ${dataBr(draft.dueDate)}`);
    if (draft.interestRate) partes.push(`juros ${draft.interestRate}%`);
  }
  return partes.join(" · ");
}

function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

function CampoSelect({
  id,
  label,
  dica,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  dica: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Rotulo htmlFor={id} dica={dica}>
        {label}
      </Rotulo>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={field}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
