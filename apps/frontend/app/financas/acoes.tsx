"use client";

import { useEffect, useState } from "react";
import {
  NOME_MES,
  STATUS_TRANSACAO,
  type AgendaResposta,
  type LancamentoVista,
  type StatusTransacao,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Dialogo } from "../../components/ui/dialogo";
import { Dica, Rotulo } from "../../components/ui/rotulo";
import { Money } from "../../components/ui/money";
import { useToast } from "../../components/ui/toast";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { Icone } from "../../components/ui/icone";
import { api } from "./api";
import { CampoValor } from "./campo-valor";
import { reaisParaCentavos } from "./reais";
import { ROTULO_CATEGORIA, ROTULO_RECORRENCIA, ROTULO_STATUS, ROTULO_TIPO, unidadeDaRecorrencia } from "./rotulos";

const field = cn(campo, "w-full");

export function AcoesTransacao({
  entry,
  entries,
  year,
  month,
  onClose,
  onAtualizar,
  embutido = false,
  status,
  commitmentId,
  onStatus,
  onCommitment,
}: {
  entry: LancamentoVista | null;
  entries: LancamentoVista[];
  year: number;
  month: number;
  onClose: () => void;
  onAtualizar: () => Promise<void>;
  embutido?: boolean;
  status?: StatusTransacao;
  commitmentId?: string;
  onStatus?: (status: StatusTransacao) => void;
  onCommitment?: (commitmentId: string) => void;
}) {
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
        status={status}
        commitmentId={commitmentId}
        onStatus={onStatus}
        onCommitment={onCommitment}
      />
    );
  }

  return (
    <Dialogo aberto={Boolean(entry)} onClose={onClose}>
      {entry ? (
        <Formulario
          key={chave}
          entry={entry}
          entries={entries}
          year={year}
          month={month}
          onClose={onClose}
          onAtualizar={onAtualizar}
          status={status}
          commitmentId={commitmentId}
          onStatus={onStatus}
          onCommitment={onCommitment}
        />
      ) : null}
    </Dialogo>
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
  status: statusExterno,
  commitmentId: compromissoExterno,
  onStatus,
  onCommitment,
}: {
  entry: LancamentoVista;
  entries: LancamentoVista[];
  year: number;
  month: number;
  onClose: () => void;
  onAtualizar: () => Promise<void>;
  embutido?: boolean;
  status?: StatusTransacao;
  commitmentId?: string;
  onStatus?: (status: StatusTransacao) => void;
  onCommitment?: (commitmentId: string) => void;
}) {
  const toast = useToast();
  const controlado = onStatus != null && onCommitment != null;
  const [statusLocal, setStatus] = useState<StatusTransacao>(entry.status);
  const [compromissos, setCompromissos] = useState<AgendaResposta["appointments"]>([]);
  const [commitmentLocal, setCommitmentId] = useState(entry.commitmentId ?? "");
  const status = controlado ? (statusExterno ?? entry.status) : statusLocal;
  const commitmentId = controlado ? (compromissoExterno ?? "") : commitmentLocal;
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
    if (!entry || ocupado || !entry.actions.remove) return;
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

  const outras = entries.filter((item) => item.actions.fixedMonth && item.id !== entry?.id);

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
              onChange={(event) => {
                const proximo = event.target.value as StatusTransacao;
                if (onStatus) onStatus(proximo);
                else setStatus(proximo);
              }}
              className={field}
            >
              {STATUS_TRANSACAO.map((item) => (
                <option key={item} value={item}>
                  {ROTULO_STATUS[item]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="transacao-compromisso" dica="Liga este lançamento a um compromisso do mês.">
              Compromisso
            </Rotulo>
            <select
              id="transacao-compromisso"
              value={commitmentId}
              onChange={(event) => {
                const proximo = event.target.value;
                if (onCommitment) onCommitment(proximo);
                else setCommitmentId(proximo);
              }}
              className={field}
            >
              <option value="">Escolha um compromisso do mês</option>
              {compromissos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.day} · {item.title}
                </option>
              ))}
            </select>
          </div>
          {entry.actions.series ? (
            <Serie id={entry.id} serie={entry.actions.series} ocupado={ocupado} executar={executar} />
          ) : null}
          {entry.actions.fixedMonth ? (
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
                  variant="default"
                  disabled={ocupado}
                  onClick={() => void atualizarValor(entry.id, marcados, amount, executar, toast)}
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
          <ControleExclusao removivel={entry.actions.remove} ocupado={ocupado} onExcluir={apagarLancamento} />
        </div>
        <Button type="button" variant="quiet" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </form>
    </>
  );
}

function Detalhe({ entry }: { entry: LancamentoVista }) {
  if (entry.actions.series) {
    return (
      <p className="text-sm text-ink-2">
        Parcela {entry.installmentNumber ?? 1} de {entry.installments ?? 0}
        {entry.actions.series === "loan" && entry.dueDate
          ? ` · vence em ${entry.dueDate.split("-").reverse().join("/")} · juros ${entry.interestRate ?? 0}%`
          : ""}
      </p>
    );
  }
  if (entry.actions.fixedMonth) {
    return (
      <p className="text-sm text-ink-2">
        Próximo vencimento {entry.nextDue?.split("-").reverse().join("/") ?? "—"}
        {entry.recurrence
          ? ` · ${ROTULO_RECORRENCIA[entry.recurrence].toLowerCase()}, a cada ${entry.recurrenceInterval ?? 1} ${unidadeDaRecorrencia(entry.recurrence)}`
          : ""}
        {entry.suspendedTotal !== 0 ? (
          <>
            {" "}
            · suspenso <Money cents={entry.suspendedTotal} />
          </>
        ) : null}
      </p>
    );
  }
  return null;
}

function Serie({
  id,
  serie,
  ocupado,
  executar,
}: {
  id: string;
  serie: "installment" | "loan";
  ocupado: boolean;
  executar: (path: string, init: RequestInit, sucesso: string) => Promise<void>;
}) {
  const trecho = serie === "loan" ? "emprestimo" : "parcelas";
  const nome = serie === "loan" ? "empréstimo" : "parcelas";
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        disabled={ocupado}
        onClick={() =>
          void executar(`/api/lancamentos/${id}/${trecho}/adiantar`, { method: "POST" }, `Parcela do ${nome} adiantada.`)
        }
      >
        Adiantar
      </Button>
      <Button
        type="button"
        disabled={ocupado}
        onClick={() =>
          void executar(
            `/api/lancamentos/${id}/${trecho}/cancelar`,
            { method: "POST" },
            serie === "loan" ? "Empréstimo cancelado." : "Parcelas canceladas.",
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
  id: string,
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
  const ids = marcados.includes(id) ? marcados : [id, ...marcados];
  const updates = ids.map((item) => ({ id: item, cents: Math.abs(cents) }));
  return executar(
    "/api/lancamentos/fixos/valor",
    { method: "POST", body: JSON.stringify({ updates }) },
    "Valor atualizado.",
  );
}

export function ControleExclusao({
  removivel,
  rotulo = "Excluir lançamento",
  compact = false,
  ocupado = false,
  onExcluir,
}: {
  removivel: boolean;
  rotulo?: string;
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

  if (!removivel) {
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
          aria-label={rotulo}
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
  return <Icone name="remove" />;
}
