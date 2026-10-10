"use client";

import { useEffect, useRef, useState } from "react";
import {
  NOME_MES,
  TIPOS_LANCAMENTO,
  type FinancasResposta,
  type GruposResposta,
  type TipoLancamento,
  type Workflow,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { PageHeader } from "../../components/ui/page-header";
import { useToast } from "../../components/ui/toast";
import { cn, focusRing } from "../../components/ui/cn";
import { TabelaLancamentos } from "./tabela";
import { VisaoGeral } from "./visao-geral";
import { doisDigitos, reaisParaCentavos } from "./reais";

type Visao = "base" | "geral";
type SessaoOpcao = GruposResposta["sessions"][number] & { groupName: string };
type Rascunho = {
  id: string;
  sessionId: string;
  type: TipoLancamento;
  description: string;
  justification: string;
  day: string;
  amount: string;
  startYear: string;
  startMonth: string;
  installments: string;
};

const field = `min-h-10 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;
const dialogClass =
  "mt-auto mb-0 w-full max-w-none rounded-t-lg border border-line bg-surface p-6 text-ink backdrop:bg-overlay/80 tab:m-auto tab:max-w-md tab:rounded-lg";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(message || "O backend não respondeu.");
  }
  return body as T;
}

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
      })
      .catch((error: Error) => {
        setFalhou(true);
        toast.erro(error.message);
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

  async function abrirLancamento() {
    try {
      const grupos = await api<GruposResposta>("/api/grupos");
      const opcoes = grupos.sessions.filter((session) => !session.endedAt).map((session) => ({
        ...session,
        groupName: grupos.groups.find((group) => group.id === session.groupId)?.name ?? "",
      }));
      if (opcoes.length === 0) {
        toast.alerta("Crie um grupo e uma sessão antes do lançamento.");
        return;
      }
      const inicio = workflow ?? { year: ano, month: 3, day: 1 };
      setSessions(opcoes);
      setDraft({
        id: crypto.randomUUID(),
        sessionId: opcoes[0]?.id ?? "",
        type: "fixo",
        description: "",
        justification: "",
        day: "1",
        amount: "",
        startYear: String(inicio.year),
        startMonth: String(inicio.month),
        installments: "2",
      });
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    const cents = reaisParaCentavos(draft.amount);
    const day = Number(draft.day);
    const startYear = Number(draft.startYear);
    const startMonth = Number(draft.startMonth);
    const parcelado = draft.type === "parcela" || draft.type === "empréstimo";
    const installments = parcelado ? Number(draft.installments) : null;
    if (!draft.sessionId) {
      toast.erro("Escolha uma sessão.");
      return;
    }
    if (!draft.description.trim()) {
      toast.erro("Dê uma descrição ao lançamento.");
      return;
    }
    if (!draft.justification.trim()) {
      toast.erro("Informe a justificativa.");
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      toast.erro("Informe o dia do mês.");
      return;
    }
    if (cents == null) {
      toast.erro("Informe o valor.");
      return;
    }
    if (parcelado && (!Number.isInteger(installments) || (installments ?? 0) < 1)) {
      toast.erro("Informe o número de parcelas.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/lancamentos", {
        method: "POST",
        body: JSON.stringify({
          id: draft.id,
          sessionId: draft.sessionId,
          type: draft.type,
          description: draft.description.trim(),
          justification: draft.justification.trim(),
          day,
          cents,
          startYear,
          startMonth,
          installments,
        }),
      });
      setDraft(null);
      toast.sucesso("Lançamento criado.");
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
                  visao === "base" ? "bg-brand-soft text-brand" : "bg-transparent text-ink-2",
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
                  visao === "geral" ? "bg-brand-soft text-brand" : "bg-transparent text-ink-2",
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
            <TabelaLancamentos entries={data.entries} workflow={workflow} year={ano} />
          ) : null}
        </div>
        <dialog
          ref={dialog}
          className={dialogClass}
          onClose={() => setDraft(null)}
        >
          <h2 className="mb-4 font-display text-lg">Novo lançamento</h2>
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
              <label htmlFor="lancamento-tipo" className="text-sm font-medium">
                Tipo
              </label>
              <select
                id="lancamento-tipo"
                value={draft?.type ?? "fixo"}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, type: event.target.value as TipoLancamento } : current,
                  )
                }
                className={field}
              >
                {TIPOS_LANCAMENTO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-2">{textoDoTipo(draft?.type ?? "fixo")}</p>
            </div>
            <div className="grid gap-1">
              <label htmlFor="lancamento-descricao" className="text-sm font-medium">
                Descrição
              </label>
              <input
                id="lancamento-descricao"
                value={draft?.description ?? ""}
                maxLength={160}
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
                <label htmlFor="lancamento-dia" className="text-sm font-medium">
                  Dia
                </label>
                <input
                  id="lancamento-dia"
                  inputMode="numeric"
                  value={draft?.day ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, day: event.target.value } : current,
                    )
                  }
                  className={field}
                />
              </div>
              <div className="grid gap-1">
                <label htmlFor="lancamento-valor" className="text-sm font-medium">
                  Valor
                </label>
                <input
                  id="lancamento-valor"
                  inputMode="decimal"
                  placeholder="Ex.: -350 ou 6200"
                  value={draft?.amount ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, amount: event.target.value } : current,
                    )
                  }
                  className={field}
                />
              </div>
            </div>
            <p className="text-xs text-ink-2">Menos para saída. Sem menos para entrada.</p>
            <div className="grid gap-4 tab:grid-cols-2">
              <div className="grid gap-1">
                <label htmlFor="lancamento-mes" className="text-sm font-medium">
                  Mês inicial
                </label>
                <select
                  id="lancamento-mes"
                  value={draft?.startMonth ?? "3"}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, startMonth: event.target.value } : current,
                    )
                  }
                  className={field}
                >
                  {NOME_MES.map((nome, index) => (
                    <option key={nome} value={index + 1}>
                      {nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <label htmlFor="lancamento-ano" className="text-sm font-medium">
                  Ano
                </label>
                <input
                  id="lancamento-ano"
                  inputMode="numeric"
                  value={draft?.startYear ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, startYear: event.target.value } : current,
                    )
                  }
                  className={field}
                />
              </div>
            </div>
            {draft?.type === "parcela" || draft?.type === "empréstimo" ? (
              <div className="grid gap-1">
                <label htmlFor="lancamento-parcelas" className="text-sm font-medium">
                  Parcelas
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
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="quiet" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Criar lançamento
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

function textoDoTipo(type: TipoLancamento) {
  if (type === "fixo") return "O valor se repete a partir do mês inicial, sem data para acabar.";
  if (type === "parcela" || type === "empréstimo") {
    return "O valor se repete em cada parcela, a partir do mês inicial.";
  }
  if (type === "adicional") return "Entra só no mês inicial.";
  return "Entra só no mês inicial. Outros meses podem receber outro valor.";
}
