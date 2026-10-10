"use client";

import { useEffect, useRef, useState } from "react";
import {
  CATEGORIAS_TRANSACAO,
  MODOS_TRANSACAO,
  PRIORIDADES_TRANSACAO,
  RECORRENCIAS,
  STATUS_TRANSACAO,
  TIPOS_TRANSACAO,
  ajustarTransacao,
  centavosComSinal,
  categoriaDeCompromisso,
  categoriaSempreEntrada,
  categoriaSempreSaida,
  prioridadeAplicavel,
  type CategoriaTransacao,
  type FinancasResposta,
  type GruposResposta,
  type Lancamento,
  type ModoTransacao,
  type PrioridadeTransacao,
  type Recorrencia,
  type StatusTransacao,
  type TipoTransacao,
  type Workflow,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { PageHeader } from "../../components/ui/page-header";
import { useToast } from "../../components/ui/toast";
import { cn, focusRing } from "../../components/ui/cn";
import { AcoesTransacao } from "./acoes";
import { TabelaLancamentos } from "./tabela";
import { VisaoGeral } from "./visao-geral";
import { api } from "./api";
import { centavosParaReais, doisDigitos, reaisParaCentavos } from "./reais";
import {
  ROTULO_CATEGORIA,
  ROTULO_MODO,
  ROTULO_PRIORIDADE,
  ROTULO_RECORRENCIA,
  ROTULO_STATUS,
  ROTULO_TIPO,
  textoDaCategoria,
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
};

const field = `min-h-10 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;
const dialogClass =
  "mt-auto mb-0 max-h-dvh w-full max-w-none overflow-y-auto rounded-t-lg border border-line bg-surface p-6 text-ink backdrop:bg-overlay/80 tab:m-auto tab:max-w-md tab:rounded-lg";

export default function Financas() {
  const toast = useToast();
  const [data, setData] = useState<FinancasResposta | null>(null);
  const [ready, setReady] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [visao, setVisao] = useState<Visao>("geral");
  const [year, setYear] = useState<number | null>(null);
  const [draft, setDraft] = useState<Rascunho | null>(null);
  const [sessions, setSessions] = useState<SessaoOpcao[]>([]);
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  function carregar() {
    return api<FinancasResposta>("/api/financas")
      .then((resposta) => {
        setData(resposta);
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
    api<FinancasResposta>("/api/financas")
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

  useEffect(() => {
    const atual = dialog.current;
    if (!atual) return;
    if (draft && !atual.open) atual.showModal();
    if (!draft && atual.open) atual.close();
  }, [draft]);

  const workflow = data?.workflow;
  const ano = year ?? workflow?.year ?? 2026;
  const vista = draft ? ajustarTransacao(draft) : null;
  const editando = Boolean(draft && data?.entries.some((entry) => entry.id === draft.id));
  const entrada = editando ? (data?.entries.find((entry) => entry.id === draft?.id) ?? null) : null;

  async function abrirEdicao(entry: Lancamento) {
    try {
      const opcoes = await sessoesAbertas();
      if (!opcoes.some((session) => session.id === entry.sessionId)) {
        opcoes.unshift({
          id: entry.sessionId,
          groupId: entry.groupId,
          name: entry.sessionName,
          description: "",
          justification: "",
          startedAt: null,
          endedAt: null,
          cents: 0,
          groupName: entry.groupName,
        });
      }
      setSessions(opcoes);
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
      const opcoes = await sessoesAbertas();
      if (opcoes.length === 0) {
        toast.alerta("Crie um grupo e uma sessão antes do lançamento.");
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
        category: "fixed",
        priority: "normal",
        amount: "",
        installments: "2",
        installmentNumber: "1",
        dueDate: date,
        interestRate: "",
        nextDueDate: date,
        recurrence: "monthly",
        recurrenceInterval: "1",
      });
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    const absoluto = reaisParaCentavos(draft.amount.replace(/^[-−]/, ""));
    const parcelado = draft.category === "installment" || draft.category === "loan";
    const installments = parcelado ? Number(draft.installments) : null;
    const installmentNumber = parcelado ? Number(draft.installmentNumber) : null;
    const juros = draft.category === "loan" ? Number(draft.interestRate.replace(",", ".")) : null;
    if (!draft.sessionId) {
      toast.erro("Escolha uma sessão.");
      return;
    }
    if (!draft.name.trim()) {
      toast.erro("Dê um nome à transação.");
      return;
    }
    if (!draft.justification.trim()) {
      toast.erro("Informe a justificativa.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      toast.erro("Informe a data.");
      return;
    }
    if (absoluto == null) {
      toast.erro("Informe o valor.");
      return;
    }
    if (parcelado && (!Number.isInteger(installments) || (installments ?? 0) < 1)) {
      toast.erro("Informe o número de parcelas.");
      return;
    }
    if (
      parcelado &&
      (!Number.isInteger(installmentNumber) ||
        (installmentNumber ?? 0) < 1 ||
        (installmentNumber ?? 0) > (installments ?? 0))
    ) {
      toast.erro("Informe a parcela atual.");
      return;
    }
    if (draft.category === "loan" && (!draft.dueDate || draft.interestRate.trim() === "" || juros == null || Number.isNaN(juros))) {
      toast.erro("Informe o vencimento e a taxa de juros.");
      return;
    }
    const intervalo = Number(draft.recurrenceInterval);
    if (draft.category === "fixed" && !draft.nextDueDate) {
      toast.erro("Informe o próximo vencimento.");
      return;
    }
    if (draft.category === "fixed" && (!Number.isInteger(intervalo) || intervalo < 1)) {
      toast.erro("Informe a recorrência.");
      return;
    }
    const pedido = ajustarTransacao(draft);
    const cents = centavosComSinal(absoluto, pedido.mode);
    setSaving(true);
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
          mode: pedido.mode,
          status: draft.status,
          transactionType: pedido.transactionType,
          category: draft.category,
          priority: pedido.priority,
          cents,
          installments,
          installmentNumber,
          dueDate: draft.category === "loan" ? draft.dueDate : null,
          interestRate: draft.category === "loan" ? juros : null,
          nextDueDate: draft.category === "fixed" ? draft.nextDueDate : null,
          recurrence: draft.category === "fixed" ? draft.recurrence : null,
          recurrenceInterval: draft.category === "fixed" ? intervalo : null,
        }),
      });
      setDraft(null);
      toast.sucesso(editando ? "Lançamento atualizado." : "Lançamento criado.");
      await carregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="Finanças"
        subtitle={workflow ? subtitulo(workflow) : undefined}
        actions={
          <>
            <div className="inline-flex overflow-hidden rounded-sm border border-line bg-surface" role="group" aria-label="Visão">
              <button
                type="button"
                aria-pressed={visao === "base"}
                onClick={() => setVisao("base")}
                className={cn(
                  "min-h-10 px-4 font-semibold",
                  focusRing,
                  visao === "base" ? "bg-brand-soft text-brand!" : "bg-transparent text-ink-2!",
                )}
              >
                Base
              </button>
              <button
                type="button"
                aria-pressed={visao === "geral"}
                onClick={() => setVisao("geral")}
                className={cn(
                  "min-h-10 px-4 font-semibold",
                  focusRing,
                  visao === "geral" ? "bg-brand-soft text-brand!" : "bg-transparent text-ink-2!",
                )}
              >
                Geral
              </button>
            </div>
            <Button variant="primary" onClick={abrirLancamento}>
              Novo lançamento
            </Button>
          </>
        }
      >
        <div className="grid min-w-0 gap-4">
          {!ready && !falhou ? (
            <p role="status" className="max-w-prose text-sm text-ink-2">
              Carregando finanças.
            </p>
          ) : null}
          {ready && workflow && data && visao === "geral" ? (
            <>
              <Ano
                year={ano}
                workflow={workflow}
                onPrevious={() => setYear(ano - 1)}
                onNext={() => setYear(ano + 1)}
              />
              <VisaoGeral entries={data.entries} workflow={workflow} year={ano} />
            </>
          ) : null}
          {ready && workflow && data && visao === "base" ? (
            <TabelaLancamentos
              entries={data.entries}
              workflow={workflow}
              year={ano}
              onEditar={(entry) => void abrirEdicao(entry)}
            />
          ) : null}
        </div>
        <dialog
          ref={dialog}
          className={dialogClass}
          onClose={() => setDraft(null)}
        >
          <h2 className="mb-4 font-display text-lg">{editando ? "Editar lançamento" : "Novo lançamento"}</h2>
          <form className="grid gap-4" onSubmit={salvar}>
            <div className="grid gap-1">
              <label htmlFor="lancamento-sessao" className="text-sm font-medium">
                Sessão
              </label>
              <select
                id="lancamento-sessao"
                value={draft?.sessionId ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, sessionId: event.target.value } : current,
                  )
                }
                className={field}
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.groupName} · {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="lancamento-nome" className="text-sm font-medium">
                Nome
              </label>
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
              <label htmlFor="lancamento-descricao" className="text-sm font-medium">
                Descrição
              </label>
              <input
                id="lancamento-descricao"
                value={draft?.description ?? ""}
                maxLength={160}
                placeholder="Opcional"
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
                className={field}
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="lancamento-justificativa" className="text-sm font-medium">
                Justificativa
              </label>
              <input
                id="lancamento-justificativa"
                value={draft?.justification ?? ""}
                maxLength={160}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, justification: event.target.value } : current,
                  )
                }
                className={field}
              />
            </div>
            <div className="grid gap-4 tab:grid-cols-2">
              <div className="grid gap-1">
                <label htmlFor="lancamento-data" className="text-sm font-medium">
                  Data
                </label>
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
                <label htmlFor="lancamento-valor" className="text-sm font-medium">
                  Valor
                </label>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-4 text-center font-semibold" aria-hidden="true">
                    {vista?.mode === "inflows" ? "+" : "−"}
                  </span>
                  <input
                    id="lancamento-valor"
                    inputMode="decimal"
                    placeholder="Ex.: 350"
                    aria-describedby="lancamento-sinal"
                    value={(draft?.amount ?? "").replace(/^[-−+]/, "")}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, amount: event.target.value.replace(/^[-−+]/, "") }
                          : current,
                      )
                    }
                    className={field}
                  />
                </div>
                <p id="lancamento-sinal" className="text-xs text-ink-2">
                  {vista?.mode === "inflows"
                    ? "O valor é enviado positivo."
                    : "O valor é enviado negativo."}
                </p>
              </div>
            </div>
            <div className="grid gap-4 tab:grid-cols-2">
              {vista && categoriaSempreEntrada(vista.category) ? (
                <p className="text-sm text-ink-2">Movimento: Entrada.</p>
              ) : vista && categoriaSempreSaida(vista.category) ? (
                <p className="text-sm text-ink-2">Movimento: Saída.</p>
              ) : (
                <CampoSelect
                  id="lancamento-movimento"
                  label="Movimento"
                  value={vista?.mode ?? "outflows"}
                  options={MODOS_TRANSACAO.map((item) => ({ value: item, label: ROTULO_MODO[item] }))}
                  onChange={(mode) =>
                    setDraft((current) =>
                      current ? { ...current, mode: mode as ModoTransacao } : current,
                    )
                  }
                />
              )}
              <CampoSelect
                id="lancamento-status"
                label="Status"
                value={draft?.status ?? "pending"}
                options={STATUS_TRANSACAO.map((item) => ({ value: item, label: ROTULO_STATUS[item] }))}
                onChange={(status) =>
                  setDraft((current) =>
                    current ? { ...current, status: status as StatusTransacao } : current,
                  )
                }
              />
              {vista && categoriaDeCompromisso(vista.category) ? (
                <p className="text-sm text-ink-2">Tipo: Compromisso.</p>
              ) : (
                <CampoSelect
                  id="lancamento-tipo"
                  label="Tipo"
                  value={vista?.transactionType ?? "unusual"}
                  options={TIPOS_TRANSACAO.map((item) => ({ value: item, label: ROTULO_TIPO[item] }))}
                  onChange={(transactionType) =>
                    setDraft((current) =>
                      current
                        ? { ...current, transactionType: transactionType as TipoTransacao }
                        : current,
                    )
                  }
                />
              )}
              <CampoSelect
                id="lancamento-categoria"
                label="Categoria"
                value={draft?.category ?? "fixed"}
                options={CATEGORIAS_TRANSACAO.map((item) => ({
                  value: item,
                  label: ROTULO_CATEGORIA[item],
                }))}
                onChange={(category) =>
                  setDraft((current) =>
                    current ? { ...current, category: category as CategoriaTransacao } : current,
                  )
                }
              />
              {vista && prioridadeAplicavel(vista.category, vista.mode) ? (
                <CampoSelect
                  id="lancamento-prioridade"
                  label="Prioridade"
                  value={vista.priority === "nopriority" ? "normal" : vista.priority}
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
              ) : (
                <p className="text-sm text-ink-2">Sem prioridade.</p>
              )}
            </div>
            <p className="text-xs text-ink-2">{textoDaCategoria(draft?.category ?? "fixed")}</p>
            {draft?.category === "installment" || draft?.category === "loan" ? (
              <div className="grid gap-4 tab:grid-cols-2">
                <div className="grid gap-1">
                  <label htmlFor="lancamento-parcela" className="text-sm font-medium">
                    Parcela atual
                  </label>
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
                <div className="grid gap-1">
                  <label htmlFor="lancamento-parcelas" className="text-sm font-medium">
                    Total de parcelas
                  </label>
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
              </div>
            ) : null}
            {draft?.category === "loan" ? (
              <div className="grid gap-4 tab:grid-cols-2">
                <div className="grid gap-1">
                  <label htmlFor="lancamento-vencimento" className="text-sm font-medium">
                    Vencimento
                  </label>
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
                  <label htmlFor="lancamento-juros" className="text-sm font-medium">
                    Juros (%)
                  </label>
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
            {draft?.category === "fixed" ? (
              <div className="grid gap-4">
                <div className="grid gap-4 tab:grid-cols-2">
                  <CampoSelect
                    id="lancamento-recorrencia"
                    label="Recorrência"
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
                    <label htmlFor="lancamento-intervalo" className="text-sm font-medium">
                      Intervalo
                    </label>
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
                <p className="text-xs text-ink-2">
                  A cada {draft.recurrenceInterval || "1"} {unidadeDaRecorrencia(draft.recurrence)}.
                </p>
                <div className="grid gap-1">
                  <label htmlFor="lancamento-proximo" className="text-sm font-medium">
                    Próximo vencimento
                  </label>
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
              </div>
            ) : null}
            {entrada ? (
              <AcoesTransacao
                embutido
                entry={entrada}
                entries={data?.entries ?? []}
                year={entrada.startYear}
                month={entrada.startMonth}
                onClose={() => setDraft(null)}
                onAtualizar={async () => {
                  const resposta = await carregar();
                  const atual = resposta?.entries.find((item) => item.id === entrada.id);
                  if (atual) setDraft(rascunhoDe(atual));
                }}
              />
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="quiet" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                {editando ? "Salvar" : "Criar lançamento"}
              </Button>
            </div>
          </form>
        </dialog>
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

function rascunhoDe(entry: Lancamento): Rascunho {
  const doMes = entry.months.find(
    (mes) => mes.year === entry.startYear && mes.month === entry.startMonth,
  );
  const valor = entry.cents !== 0 ? entry.cents : (doMes?.cents ?? entry.cents);
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
    amount: centavosParaReais(valor),
    installments: String(entry.installments ?? 2),
    installmentNumber: String(entry.installmentNumber ?? 1),
    dueDate: entry.dueDate ?? entry.date,
    interestRate: entry.interestRate == null ? "" : String(entry.interestRate).replace(".", ","),
    nextDueDate: entry.nextDueDate ?? entry.date,
    recurrence: entry.recurrence ?? "monthly",
    recurrenceInterval: String(entry.recurrenceInterval ?? 1),
  };
}

function dataIso(year: number, month: number, day: number) {
  return `${year}-${doisDigitos(month)}-${doisDigitos(Math.min(Math.max(day, 1), 28))}`;
}

function CampoSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
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
