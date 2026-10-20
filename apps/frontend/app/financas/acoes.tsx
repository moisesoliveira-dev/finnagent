"use client";

import { useEffect, useRef, useState } from "react";
import {
  NOME_MES,
  STATUS_TRANSACAO,
  centavosComSinal,
  ocorrenciasDoLancamento,
  proximoVencimento,
  type AgendaResposta,
  type Lancamento,
  type StatusTransacao,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Dica, Rotulo } from "../../components/ui/rotulo";
import { Money } from "../../components/ui/money";
import { useToast } from "../../components/ui/toast";
import { focusRing } from "../../components/ui/cn";
import { api } from "./api";
import { CampoValor } from "./campo-valor";
import { reaisParaCentavos } from "./reais";
import { ROTULO_CATEGORIA, ROTULO_RECORRENCIA, ROTULO_STATUS, ROTULO_TIPO, unidadeDaRecorrencia } from "./rotulos";

const field = `min-h-10 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;
const dialogClass =
  "rounded-lg border border-line bg-surface text-ink backdrop:bg-overlay/80";

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

  async function apagarLancamento() {
    if (!entry || ocupado || entry.synced) return;
    setOcupado(true);
    try {
      await api(`/api/lancamentos/${entry.id}`, { method: "DELETE" });
      toast.sucesso("Lançamento apagado.");
      await onAtualizar();
      onClose();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível apagar o lançamento.");
      throw error;
    } finally {
      setOcupado(false);
    }
  }

  const outras = entries.filter((item) => item.category === "fixed" && item.id !== entry?.id);

  const corpo = (
        <>
          <Detalhe entry={entry} />
          <div className="grid gap-1">
            <Rotulo htmlFor="transacao-status" dica="A situação deste lançamento agora.">
              Status
            </Rotulo>
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
            <Rotulo htmlFor="transacao-compromisso" dica="Liga este lançamento a um compromisso do mês.">
              Compromisso
            </Rotulo>
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
                  <Rotulo htmlFor="transacao-mes" dica="O mês do valor fixo que você quer ajustar.">
                    Mês
                  </Rotulo>
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
                  <Rotulo htmlFor="transacao-ano" dica="O ano desse mês.">
                    Ano
                  </Rotulo>
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
                <Rotulo htmlFor="transacao-valor" dica="O valor que passa a valer a partir daqui.">
                  Novo valor
                </Rotulo>
                <CampoValor id="transacao-valor" value={amount} onChange={setAmount} className={field} />
              </div>
              {outras.length > 0 ? (
                <fieldset className="grid gap-2">
                  <legend className="flex items-center gap-1 text-sm font-medium">
                    Aplicar também em
                    <Dica texto="Outros valores fixos que recebem o mesmo valor." />
                  </legend>
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
        </>
  );

  if (embutido) {
    return <div className="grid gap-4 border-t border-line pt-4">{corpo}</div>;
  }

  return (
    <>
    <div className="mb-4">
      <h2 className="font-display text-lg">{entry.name || entry.description}</h2>
      <p className="text-sm text-ink-2">
        {ROTULO_CATEGORIA[entry.category]} · {ROTULO_TIPO[entry.transactionType]} ·{" "}
        {ROTULO_STATUS[entry.status]}
      </p>
    </div>
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="dialog-corpo grid gap-4">{corpo}</div>
      <div className="dialog-acoes">
        <div className="mr-auto">
          <ControleExclusao synced={entry.synced} ocupado={ocupado} onExcluir={apagarLancamento} />
        </div>
        <Button type="button" variant="quiet" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </form>
    </>
  );
}

function mesesSuspensos(entry: Lancamento) {
  return entry.adjustments.filter((ajuste) => ajuste.effect === "suspended").length;
}

function valorSuspenso(entry: Lancamento) {
  const sinal = entry.mode === "outflows" ? -1 : 1;
  return sinal * Math.abs(entry.cents) * mesesSuspensos(entry);
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
        Próximo vencimento {proximoVencimento(ocorrenciasDoLancamento(entry))?.split("-").reverse().join("/") ?? "—"}
        {entry.recurrence
          ? ` · ${ROTULO_RECORRENCIA[entry.recurrence].toLowerCase()}, a cada ${entry.recurrenceInterval ?? 1} ${unidadeDaRecorrencia(entry.recurrence)}`
          : ""}
        {mesesSuspensos(entry) > 0 ? (
          <>
            {" "}
            · suspenso <Money cents={valorSuspenso(entry)} />
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

export function ControleExclusao({
  synced,
  compact = false,
  ocupado = false,
  onExcluir,
}: {
  synced: boolean;
  compact?: boolean;
  ocupado?: boolean;
  onExcluir: () => Promise<void>;
}) {
  const [confirma, setConfirma] = useState(false);
  const [local, setLocal] = useState(false);
  const busy = ocupado || local;

  async function confirmar() {
    setLocal(true);
    try {
      await onExcluir();
      setConfirma(false);
    } catch {
      setConfirma(true);
    } finally {
      setLocal(false);
    }
  }

  if (synced) {
    if (compact) {
      return (
        <Button
          type="button"
          variant="quiet"
          className="size-10 px-0"
          disabled
          aria-label="Sincronizado com o extrato. Não pode ser apagado."
        >
          <Lixeira />
        </Button>
      );
    }
    return <p className="text-sm text-ink-2">Sincronizado com o extrato. Não pode ser apagado.</p>;
  }

  if (confirma && compact) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="danger" disabled={busy} onClick={() => void confirmar()}>
          Apagar
        </Button>
        <Button type="button" variant="quiet" disabled={busy} onClick={() => setConfirma(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  if (!confirma) {
    if (compact) {
      return (
        <Button
          type="button"
          variant="quiet"
          className="size-10 px-0"
          aria-label="Excluir lançamento"
          disabled={busy}
          onClick={() => setConfirma(true)}
        >
          <Lixeira />
        </Button>
      );
    }
    return (
      <Button type="button" variant="danger" disabled={busy} onClick={() => setConfirma(true)}>
        Excluir
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm">Apagar este lançamento?</p>
      <Button type="button" variant="danger" disabled={busy} onClick={() => void confirmar()}>
        Apagar
      </Button>
      <Button type="button" variant="quiet" disabled={busy} onClick={() => setConfirma(false)}>
        Cancelar
      </Button>
    </div>
  );
}

function Lixeira() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
    </svg>
  );
}
