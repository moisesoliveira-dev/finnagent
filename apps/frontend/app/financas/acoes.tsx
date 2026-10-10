"use client";

import { useEffect, useRef, useState } from "react";
import {
  NOME_MES,
  STATUS_TRANSACAO,
  centavosComSinal,
  type AgendaResposta,
  type Lancamento,
  type StatusTransacao,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Money } from "../../components/ui/money";
import { useToast } from "../../components/ui/toast";
import { focusRing } from "../../components/ui/cn";
import { api } from "./api";
import { reaisParaCentavos } from "./reais";
import { ROTULO_CATEGORIA, ROTULO_RECORRENCIA, ROTULO_STATUS, ROTULO_TIPO, unidadeDaRecorrencia } from "./rotulos";

const field = `min-h-10 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;
const dialogClass =
  "mt-auto mb-0 max-h-dvh w-full max-w-none overflow-y-auto rounded-t-lg border border-line bg-surface p-6 text-ink backdrop:bg-overlay/80 tab:m-auto tab:max-w-md tab:rounded-lg";

export function AcoesTransacao({
  entry,
  entries,
  year,
  month,
  onClose,
  onAtualizar,
  embutido = false,
}: {
  entry: Lancamento | null;
  entries: Lancamento[];
  year: number;
  month: number;
  onClose: () => void;
  onAtualizar: () => Promise<void>;
  embutido?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const atual = dialog.current;
    if (!atual) return;
    if (entry && !atual.open) atual.showModal();
    if (!entry && atual.open) atual.close();
  }, [entry]);

  const chave = entry
    ? `${entry.id}:${entry.status}:${entry.commitmentId}:${entry.installmentNumber}:${entry.cents}:${entry.suspendedCents}:${entry.adjustments.length}`
    : "vazio";

  if (embutido && entry) {
    return (
      <Formulario
        key={chave}
        embutido
        entry={entry}
        entries={entries}
        year={year}
        month={month}
        onClose={onClose}
        onAtualizar={onAtualizar}
      />
    );
  }

  return (
    <dialog ref={dialog} className={dialogClass} onClose={onClose}>
      {entry ? (
        <Formulario
          key={chave}
          entry={entry}
          entries={entries}
          year={year}
          month={month}
          onClose={onClose}
          onAtualizar={onAtualizar}
        />
      ) : null}
    </dialog>
  );
}

function Formulario({
  entry,
  entries,
  year,
  month,
  onClose,
  onAtualizar,
  embutido = false,
}: {
  entry: Lancamento;
  entries: Lancamento[];
  year: number;
  month: number;
  onClose: () => void;
  onAtualizar: () => Promise<void>;
  embutido?: boolean;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<StatusTransacao>(entry.status);
  const [compromissos, setCompromissos] = useState<AgendaResposta["appointments"]>([]);
  const [commitmentId, setCommitmentId] = useState(entry.commitmentId ?? "");
  const [mes, setMes] = useState(month);
  const [ano, setAno] = useState(String(year));
  const [amount, setAmount] = useState("");
  const [marcados, setMarcados] = useState<string[]>([entry.id]);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ativo = true;
    api<AgendaResposta>(`/api/agenda?year=${year}&month=${month}`)
      .then((resposta) => {
        if (ativo) setCompromissos(resposta.appointments);
      })
      .catch(() => {
        if (ativo) setCompromissos([]);
      });
    return () => {
      ativo = false;
    };
  }, [year, month]);

  async function executar(path: string, init: RequestInit, sucesso: string) {
    if (!entry || ocupado) return;
    setOcupado(true);
    try {
      await api(path, init);
      toast.sucesso(sucesso);
      await onAtualizar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível atualizar a transação.");
    } finally {
      setOcupado(false);
    }
  }

  const outras = entries.filter((item) => item.category === "fixed" && item.id !== entry?.id);

  const corpo = (
        <>
          {embutido ? null : (
          <div>
            <h2 className="font-display text-lg">{entry.name || entry.description}</h2>
            <p className="text-sm text-ink-2">
              {ROTULO_CATEGORIA[entry.category]} · {ROTULO_TIPO[entry.transactionType]} ·{" "}
              {ROTULO_STATUS[entry.status]}
            </p>
          </div>
          )}
          <Detalhe entry={entry} />
          <div className="grid gap-1">
            <label htmlFor="transacao-status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="transacao-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusTransacao)}
              className={field}
            >
              {STATUS_TRANSACAO.map((item) => (
                <option key={item} value={item}>
                  {ROTULO_STATUS[item]}
                </option>
              ))}
            </select>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  void executar(
                    `/api/lancamentos/${entry.id}/status`,
                    { method: "PATCH", body: JSON.stringify({ status }) },
                    "Status atualizado.",
                  )
                }
              >
                Atualizar status
              </Button>
            </div>
          </div>
          <div className="grid gap-1">
            <label htmlFor="transacao-compromisso" className="text-sm font-medium">
              Compromisso
            </label>
            <select
              id="transacao-compromisso"
              value={commitmentId}
              onChange={(event) => setCommitmentId(event.target.value)}
              className={field}
            >
              <option value="">Escolha um compromisso do mês</option>
              {compromissos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.day} · {item.title}
                </option>
              ))}
            </select>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={ocupado || !commitmentId}
                onClick={() =>
                  void executar(
                    `/api/lancamentos/${entry.id}/compromisso`,
                    { method: "POST", body: JSON.stringify({ commitmentId }) },
                    "Compromisso associado.",
                  )
                }
              >
                Associar compromisso
              </Button>
            </div>
          </div>
          {entry.category === "installment" || entry.category === "loan" ? (
            <Serie entry={entry} ocupado={ocupado} executar={executar} />
          ) : null}
          {entry.category === "fixed" ? (
            <div className="grid gap-3">
              <div className="grid gap-4 tab:grid-cols-2">
                <div className="grid gap-1">
                  <label htmlFor="transacao-mes" className="text-sm font-medium">
                    Mês
                  </label>
                  <select
                    id="transacao-mes"
                    value={mes}
                    onChange={(event) => setMes(Number(event.target.value))}
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
                  <label htmlFor="transacao-ano" className="text-sm font-medium">
                    Ano
                  </label>
                  <input
                    id="transacao-ano"
                    inputMode="numeric"
                    value={ano}
                    onChange={(event) => setAno(event.target.value)}
                    className={field}
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void ajustar(entry.id, ano, mes, "cancelar", executar, toast)}
                >
                  Cancelar o mês
                </Button>
                <Button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void ajustar(entry.id, ano, mes, "suspender", executar, toast)}
                >
                  Suspender o mês
                </Button>
              </div>
              <div className="grid gap-1">
                <label htmlFor="transacao-valor" className="text-sm font-medium">
                  Novo valor
                </label>
                <p className="text-xs text-ink-2">O sinal segue o movimento de cada transação.</p>
                <input
                  id="transacao-valor"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={field}
                />
              </div>
              {outras.length > 0 ? (
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">Aplicar também em</legend>
                  {outras.map((item) => (
                    <label key={item.id} className="flex min-h-10 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className={`size-4 accent-brand ${focusRing}`}
                        checked={marcados.includes(item.id)}
                        onChange={(event) =>
                          setMarcados((atual) =>
                            event.target.checked
                              ? [...atual, item.id]
                              : atual.filter((id) => id !== item.id),
                          )
                        }
                      />
                      {item.name || item.description}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  disabled={ocupado}
                  onClick={() => void atualizarValor(entry, entries, marcados, amount, executar, toast)}
                >
                  Atualizar valor
                </Button>
              </div>
            </div>
          ) : null}
          {embutido ? null : (
          <div className="flex justify-end">
            <Button type="button" variant="quiet" onClick={onClose}>
              Fechar
            </Button>
          </div>
          )}
        </>
  );

  if (embutido) return <div className="grid gap-4">{corpo}</div>;

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      {corpo}
    </form>
  );
}

function Detalhe({ entry }: { entry: Lancamento }) {
  if (entry.category === "installment" || entry.category === "loan") {
    return (
      <p className="text-sm text-ink-2">
        Parcela {entry.installmentNumber ?? 1} de {entry.installments ?? 0}
        {entry.category === "loan" && entry.dueDate
          ? ` · vence em ${entry.dueDate.split("-").reverse().join("/")} · juros ${entry.interestRate ?? 0}%`
          : ""}
      </p>
    );
  }
  if (entry.category === "fixed") {
    return (
      <p className="text-sm text-ink-2">
        Próximo vencimento {entry.nextDueDate?.split("-").reverse().join("/") ?? "—"}
        {entry.recurrence
          ? ` · ${ROTULO_RECORRENCIA[entry.recurrence].toLowerCase()}, a cada ${entry.recurrenceInterval ?? 1} ${unidadeDaRecorrencia(entry.recurrence)}`
          : ""}
        {entry.suspendedCents ? (
          <>
            {" "}
            · suspenso <Money cents={entry.suspendedCents} />
          </>
        ) : null}
      </p>
    );
  }
  return null;
}

function Serie({
  entry,
  ocupado,
  executar,
}: {
  entry: Lancamento;
  ocupado: boolean;
  executar: (path: string, init: RequestInit, sucesso: string) => Promise<void>;
}) {
  const trecho = entry.category === "loan" ? "emprestimo" : "parcelas";
  const nome = entry.category === "loan" ? "empréstimo" : "parcelas";
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        disabled={ocupado}
        onClick={() =>
          void executar(`/api/lancamentos/${entry.id}/${trecho}/adiantar`, { method: "POST" }, `Parcela do ${nome} adiantada.`)
        }
      >
        Adiantar
      </Button>
      <Button
        type="button"
        disabled={ocupado}
        onClick={() =>
          void executar(
            `/api/lancamentos/${entry.id}/${trecho}/cancelar`,
            { method: "POST" },
            entry.category === "loan" ? "Empréstimo cancelado." : "Parcelas canceladas.",
          )
        }
      >
        Cancelar
      </Button>
    </div>
  );
}

function ajustar(
  id: string,
  ano: string,
  mes: number,
  acao: "cancelar" | "suspender",
  executar: (path: string, init: RequestInit, sucesso: string) => Promise<void>,
  toast: { erro: (mensagem: string) => void },
) {
  const year = Number(ano);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    toast.erro("Informe o ano.");
    return;
  }
  return executar(
    `/api/lancamentos/${id}/fixo/${acao}`,
    { method: "POST", body: JSON.stringify({ year, month: mes }) },
    acao === "cancelar" ? "Mês cancelado." : "Mês suspenso.",
  );
}

function atualizarValor(
  entry: Lancamento,
  entries: Lancamento[],
  marcados: string[],
  amount: string,
  executar: (path: string, init: RequestInit, sucesso: string) => Promise<void>,
  toast: { erro: (mensagem: string) => void },
) {
  const cents = reaisParaCentavos(amount.replace(/^-/, ""));
  if (cents == null) {
    toast.erro("Informe o valor.");
    return;
  }
  const ids = marcados.includes(entry.id) ? marcados : [entry.id, ...marcados];
  const updates = ids.flatMap((id) => {
    const item = entries.find((atual) => atual.id === id);
    if (!item || item.category !== "fixed") return [];
    return [{ id, cents: centavosComSinal(cents, item.mode) }];
  });
  if (updates.length === 0) {
    toast.erro("Escolha uma transação fixa.");
    return;
  }
  return executar(
    "/api/lancamentos/fixos/valor",
    { method: "POST", body: JSON.stringify({ updates }) },
    "Valor atualizado.",
  );
}
