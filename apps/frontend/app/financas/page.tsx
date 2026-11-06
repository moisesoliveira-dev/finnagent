"use client";

import { useEffect, useState } from "react";
import {
  CALENDARIO_NACIONAL,
  CATEGORIAS_TRANSACAO,
  MODOS_TRANSACAO,
  PADROES_DE_VENCIMENTO_INICIAIS,
  RECORRENCIAS,
  REGRA_SEM_AJUSTE,
  sessaoAceitaNoMes,
  STATUS_TRANSACAO,
  aceitaRegraDeVencimento,
  criarCalendario,
  regraPadrao,
  type CalendarioDeDiasUteis,
  type CategoriaTransacao,
  type Configuracoes,
  type Conta,
  type ContasResposta,
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
import { Troca } from "../../components/ui/movimento";
import { Icone } from "../../components/ui/icone";
import { PageHeader } from "../../components/ui/page-header";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { caixaDeMarcar, campo, cn, focusRing } from "../../components/ui/cn";
import { AcoesTransacao, ControleExclusao } from "./acoes";
import { OcorrenciasDoLancamento } from "./ocorrencias";
import { TabelaLancamentos } from "./tabela";
import { ViradaDoAno } from "./virada";
import { VisaoGeral } from "./visao-geral";
import { api } from "./api";
import { CampoValor } from "./campo-valor";
import { useCelular } from "../../components/ui/tela";
import { Emprestimos } from "./emprestimos";
import { RegraDoVencimento } from "./regra-do-vencimento";
import { centavosParaReais, doisDigitos, reaisParaCentavos } from "./reais";
import {
  ROTULO_CATEGORIA,
  ROTULO_MODO,
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
  /** Empréstimo: de quem é e o total combinado. */
  counterparty: string;
  principal: string;
  nextDueDate: string;
  recurrence: Recorrencia;
  recurrenceInterval: string;
  commitmentId: string;
  coveredById: string;
  accountId: string;
  transfer: boolean;
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
  // No celular só existe a Base: a Geral é uma tabela de meses, para o tablet em diante.
  const celular = useCelular();
  const visaoEfetiva: Visao = celular ? "base" : visao;
  const [deslize, setDeslize] = useState(0);
  const [year, setYear] = useState<number | null>(null);
  const [draft, setDraft] = useState<Rascunho | null>(null);
  const [foco, setFoco] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessaoOpcao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [saving, setSaving] = useState(false);
  const [vencimentos, setVencimentos] = useState<PadroesDeVencimento>(PADROES_DE_VENCIMENTO_INICIAIS);
  const [calendario, setCalendario] = useState<CalendarioDeDiasUteis>(CALENDARIO_NACIONAL);
  const [atualizando, setAtualizando] = useState(false);

  // As contas vêm à parte, para a lista do formulário; a gestão delas fica na aba Contas.
  useEffect(() => {
    let ativo = true;
    api<ContasResposta>("/api/contas")
      .then((resposta) => {
        if (ativo) setContas(resposta.accounts);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

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

  // Recarrega a tela sob demanda: um lançamento criado em outra aba, como o do assistente, não chega sozinho.
  async function atualizar() {
    if (atualizando) return;
    setAtualizando(true);
    const resposta = await carregar();
    if (resposta) toast.sucesso("Finanças atualizadas.");
    setAtualizando(false);
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
  const editando = Boolean(draft && data?.entries.some((entry) => entry.id === draft.id));
  const entrada = editando ? (data?.entries.find((entry) => entry.id === draft?.id) ?? null) : null;
  const serieResolvida = Boolean(editando && entrada?.termsLocked);
  const destinos = (data?.entries ?? []).filter((entry) => {
    if (!draft || entry.id === draft.id) return false;
    if (entry.coveredById && entry.id !== draft.coveredById) return false;
    return true;
  });
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
          limitCents: null,
          categories: [...CATEGORIAS_TRANSACAO],
          occupiedMonths: [],
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
      const inicio = workflow ?? { year: ano, month: 3, day: 1 };
      const date = dataIso(inicio.year, inicio.month, inicio.day);
      // A sessão Fixo só sai da lista no mês em que já tem a transação; a data muda a lista no formulário.
      const opcoes = abertas.filter((session) => sessaoAceitaNoMes(session, inicio.year, inicio.month));
      if (opcoes.length === 0) {
        toast.alerta(
          abertas.length === 0
            ? "Crie um grupo e uma sessão antes do lançamento."
            : "As sessões fixas já têm a transação deste mês.",
        );
        return;
      }
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
        counterparty: "",
        principal: "",
        nextDueDate: date,
        recurrence: "monthly",
        recurrenceInterval: "1",
        commitmentId: "",
        coveredById: "",
        accountId: "",
        transfer: false,
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
          counterparty: draft.counterparty.trim(),
          principalCents: reaisParaCentavos(draft.principal),
          nextDueDate: draft.nextDueDate || null,
          recurrence: draft.recurrence,
          recurrenceInterval: numeroDoCampo(draft.recurrenceInterval),
          coveredById: draft.coveredById || null,
          accountId: draft.accountId || null,
          transfer: draft.transfer,
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
              className="hidden tab:inline-flex"
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
            <Button variant="default" carregando={atualizando} onClick={atualizar}>
              {atualizando ? (
                "Atualizando"
              ) : (
                <>
                  <Icone name="refresh" />
                  Atualizar
                </>
              )}
            </Button>
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
          {ready && data ? (
            <Emprestimos
              entries={data.entries}
              onMudou={async () => {
                await carregar();
              }}
            />
          ) : null}
          {ready && workflow && data ? (
            <Troca id={`${visaoEfetiva}-${ano}`} direcao={deslize} className="grid min-w-0 gap-4">
              {visaoEfetiva === "geral" ? (
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
                  .filter((session) => (draft ? sessaoAceitaNoMes(session, ...anoEMes(draft.date)) : true) || session.id === draft?.sessionId)
                  .map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.groupName} · {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="dialog-par">
              <CampoSelect
                id="lancamento-conta"
                label="Conta"
                dica="De que conta o dinheiro sai ou em que conta entra. Sem conta, o lançamento só entra na sobra."
                value={draft?.accountId ?? ""}
                options={[{ value: "", label: "Sem conta" }, ...contas.map((conta) => ({ value: conta.id, label: conta.name }))]}
                onChange={(accountId) => setDraft((current) => (current ? { ...current, accountId } : current))}
              />
              <label className="flex min-h-10 items-center gap-2 self-end text-sm">
                <input
                  type="checkbox"
                  className={caixaDeMarcar}
                  checked={draft?.transfer ?? false}
                  onChange={(event) => setDraft((current) => (current ? { ...current, transfer: event.target.checked } : current))}
                />
                Transferência entre minhas contas (não entra na sobra)
              </label>
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
            {draft ? (
              <CampoSelect
                id="lancamento-cobertura"
                label="Já entra em"
                dica="Se este valor já faz parte de outro lançamento, ele não entra de novo na sobra. O outro é que conta."
                value={draft.coveredById}
                options={[
                  { value: "", label: "Este valor entra na sobra" },
                  ...destinos.map((entry) => ({
                    value: entry.id,
                    label: entry.name || entry.description || "Lançamento",
                  })),
                ]}
                onChange={(coveredById) =>
                  setDraft((current) => (current ? { ...current, coveredById } : current))
                }
              />
            ) : null}
            {serieResolvida ? (
              <p className="text-sm text-ink-2">
                O que já foi pago, cancelado ou estornado permanece. O valor e a regra novos valem para o que ainda está pendente.
              </p>
            ) : null}
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
            </div>
            {draft && regra?.installments ? (
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
              </div>
            ) : null}
            {draft && regra?.loan ? (
              <div className="dialog-par">
                <div className="grid gap-1">
                  <Rotulo htmlFor="lancamento-pessoa" dica="Quem emprestou para você, ou quem recebeu de você.">
                    Pessoa
                  </Rotulo>
                  <input
                    id="lancamento-pessoa"
                    maxLength={80}
                    required
                    value={draft.counterparty}
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, counterparty: event.target.value } : current))
                    }
                    className={field}
                  />
                </div>
                <div className="grid gap-1">
                  <Rotulo
                    htmlFor="lancamento-total"
                    dica="O total combinado, com juros se houver. O saldo é ele menos o que já foi pago. O valor acima é a parcela combinada, só como previsão."
                  >
                    Total combinado
                  </Rotulo>
                  <CampoValor
                    id="lancamento-total"
                    required
                    value={draft.principal}
                    onChange={(principal) => setDraft((current) => (current ? { ...current, principal } : current))}
                    className={field}
                  />
                </div>
              </div>
            ) : null}
            {draft && regra?.recurrence ? (
              <div className="grid gap-4">
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
              // O padrão da conta vale sem a pessoa abrir isto. Quem precisa de outro dia útil abre.
              <details className="grid gap-4" open={editando || draft.dueRuleManual}>
                <summary className={cn("cursor-pointer text-sm text-ink-2", focusRing)}>Mais opções: vencimento em dia útil</summary>
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
              </details>
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
                  <ControleExclusao sincronizado={entrada.synced} onExcluir={() => excluir(entrada)} />
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

/** O ano e o mês de uma data ISO; sem data válida, o mês atual. */
function anoEMes(iso: string): [number, number] {
  const [ano, mes] = iso.split("-").map(Number);
  if (!ano || !mes) return [new Date().getFullYear(), new Date().getMonth() + 1];
  return [ano, mes];
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
    counterparty: entry.counterparty ?? "",
    principal: entry.principalCents ? centavosParaReais(entry.principalCents) : "",
    nextDueDate: entry.nextDueDate ?? entry.date,
    recurrence: entry.recurrence ?? "monthly",
    recurrenceInterval: String(entry.recurrenceInterval ?? 1),
    commitmentId: entry.commitmentId ?? "",
    coveredById: entry.coveredById ?? "",
    accountId: entry.accountId ?? "",
    transfer: entry.transfer ?? false,
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
