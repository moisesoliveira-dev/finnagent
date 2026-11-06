"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  NOME_MES,
  ROTULO_DO_TIPO_DE_CONTA,
  dataContabil,
  ocorrenciasDoLancamento,
  resumoDaConta,
  type Conta,
  type ContasResposta,
  type Extrato,
  type ExtratosResposta,
  type FinancasVista,
  type LancamentoVista,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { cn, focusRing } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { Carregando } from "../../components/ui/esqueleto";
import { List } from "../../components/ui/list";
import { Money } from "../../components/ui/money";
import { Troca } from "../../components/ui/movimento";
import { PageHeader } from "../../components/ui/page-header";
import { Stat } from "../../components/ui/stat";
import { useToast } from "../../components/ui/toast";
import { api } from "../financas/api";
import { DialogoDeConta, type PedidoDeConta } from "./dialogo";

const ROTULO_DO_EXTRATO: Record<Extrato["status"], string> = {
  importado: "Importado",
  com_erros: "Com erros",
  processando: "Processando",
  falhou: "Falhou",
};
const TOM_DO_EXTRATO: Record<Extrato["status"], "ok" | "pending" | "neg"> = {
  importado: "ok",
  com_erros: "pending",
  processando: "pending",
  falhou: "neg",
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

type Movimento = {
  chave: string;
  date: string;
  descricao: string;
  detalhe: string;
  cents: number;
  pendente: boolean;
  /** O saldo da conta depois deste movimento. O pendente é previsão. */
  saldo: number;
};

/** Os movimentos de uma conta num mês, pela data em que contam, com o saldo correndo a partir do início do mês. */
function movimentosDoMes(conta: Conta, entries: LancamentoVista[], year: number, month: number) {
  const inicio = `${year}-${String(month).padStart(2, "0")}-01`;
  const chave = inicio.slice(0, 7);
  let saldoInicial = conta.openingCents;
  const doMes: Omit<Movimento, "saldo">[] = [];
  for (const entry of entries) {
    if (entry.accountId !== conta.id) continue;
    for (const item of ocorrenciasDoLancamento(entry)) {
      if (item.status !== "pending" && item.status !== "completed") continue;
      const data = dataContabil(item);
      const cents = item.status === "completed" && item.paidCents != null ? item.paidCents : item.plannedCents;
      if (data < inicio) {
        if (item.status === "completed") saldoInicial += cents;
        continue;
      }
      if (!data.startsWith(chave)) continue;
      doMes.push({
        chave: `${entry.id}:${item.number}`,
        date: data,
        descricao: entry.name || entry.description,
        detalhe: [item.kind === "multa" ? "Multa e juros" : "", `${entry.groupName} › ${entry.sessionName}`].filter(Boolean).join(" · "),
        cents,
        pendente: item.status === "pending",
      });
    }
  }
  doMes.sort((a, b) => a.date.localeCompare(b.date) || a.descricao.localeCompare(b.descricao, "pt-BR"));
  let saldo = saldoInicial;
  const movimentos: Movimento[] = doMes.map((item) => {
    saldo += item.cents;
    return { ...item, saldo };
  });
  return { saldoInicial, movimentos, saldoFinal: saldo };
}

export default function Contas() {
  const toast = useToast();
  const hoje = hojeIso();
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [entries, setEntries] = useState<LancamentoVista[]>([]);
  const [extratos, setExtratos] = useState<Extrato[]>([]);
  const [falhou, setFalhou] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [mes, setMes] = useState({ year: Number(hoje.slice(0, 4)), month: Number(hoje.slice(5, 7)) });
  const [deslize, setDeslize] = useState(0);
  const [pedido, setPedido] = useState<PedidoDeConta | undefined>(undefined);
  const [excluindo, setExcluindo] = useState<Conta | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const buscar = useCallback(
    () =>
      Promise.all([
        api<ContasResposta>("/api/contas"),
        api<FinancasVista>("/api/financas"),
        api<ExtratosResposta>("/api/extratos").catch(() => ({ accounts: [], statements: [] }) as ExtratosResposta),
      ]),
    [],
  );

  useEffect(() => {
    let ativo = true;
    buscar()
      .then(([c, f, e]) => {
        if (!ativo) return;
        setContas(c.accounts);
        setEntries(f.entries);
        setExtratos(e.statements);
        setFalhou(false);
      })
      .catch((error: Error) => {
        if (!ativo) return;
        setFalhou(true);
        toast.erro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, [buscar, toast]);

  async function carregar() {
    try {
      const [c, f, e] = await buscar();
      setContas(c.accounts);
      setEntries(f.entries);
      setExtratos(e.statements);
      setFalhou(false);
    } catch (error) {
      setFalhou(true);
      toast.erro(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  const conta = contas ? (contas.find((item) => item.id === escolhida) ?? contas[0] ?? null) : null;
  const resumo = conta ? resumoDaConta(conta, entries, hoje) : null;
  const doMes = conta ? movimentosDoMes(conta, entries, mes.year, mes.month) : null;
  const extratosDaConta = conta ? extratos.filter((item) => item.accountId === conta.id).sort((a, b) => b.importedAt.localeCompare(a.importedAt)) : [];
  const cartao = conta?.kind === "cartao";

  function mudarMes(delta: number) {
    setDeslize(delta);
    const data = new Date(mes.year, mes.month - 1 + delta, 1);
    setMes({ year: data.getFullYear(), month: data.getMonth() + 1 });
  }

  async function excluir(alvo: Conta) {
    setOcupado(true);
    try {
      await api(`/api/contas/${alvo.id}`, { method: "DELETE" });
      toast.sucesso(`Conta ${alvo.name} excluída. Os lançamentos dela ficaram sem conta.`);
      setExcluindo(null);
      if (escolhida === alvo.id) setEscolhida(null);
      await carregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível excluir a conta.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <PageHeader
      title="Contas"
      subtitle="O saldo de cada conta e a fatura de cada cartão, pelos lançamentos ligados a eles."
      actions={
        <Button variant="primary" onClick={() => setPedido(null)}>
          Nova conta
        </Button>
      }
    >
      {!contas && !falhou ? <Carregando texto="Carregando as contas." titulo linhas={4} /> : null}
      {contas && contas.length === 0 ? (
        <p className="max-w-prose text-ink-2">
          Cadastre a conta do banco e o cartão para ver o saldo de cada um. O extrato importado também cria a conta.
        </p>
      ) : null}
      {contas && conta && resumo && doMes ? (
        <div className="grid min-w-0 gap-6 desk:grid-cols-3">
          <section className="grid min-w-0 content-start gap-3 desk:col-span-1" aria-label="Suas contas">
            <ul className="grid gap-3 tab:grid-cols-2 desk:grid-cols-1">
              {contas.map((item) => {
                const r = resumoDaConta(item, entries, hoje);
                const atual = item.id === conta.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={atual}
                      onClick={() => {
                        setEscolhida(item.id);
                        setDeslize(0);
                      }}
                      className={cn(
                        "grid w-full min-w-0 gap-2 border p-4 text-left transition-colors hover:border-brand",
                        atual ? "border-brand bg-brand-soft" : "border-line bg-surface",
                        focusRing,
                      )}
                    >
                      <span className="flex min-w-0 items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{item.name}</span>
                        <span className="etiqueta shrink-0 text-ink-2">{ROTULO_DO_TIPO_DE_CONTA[item.kind]}</span>
                      </span>
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-ink-2">{item.kind === "cartao" ? "Lançado na fatura" : "Saldo hoje"}</span>
                        <Money cents={r.saldoCents} strong />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="grid min-w-0 content-start gap-4 desk:col-span-2" aria-label={`Conta ${conta.name}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg">{conta.name}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                  <Chip tone={cartao ? "event" : "info"}>{ROTULO_DO_TIPO_DE_CONTA[conta.kind]}</Chip>
                  <span>Saldo inicial {<Money cents={conta.openingCents} />}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="default" onClick={() => setPedido(conta)}>
                  Editar
                </Button>
                <Button
                  variant="quiet"
                  disabled={extratosDaConta.length > 0}
                  title={extratosDaConta.length > 0 ? "Apague os extratos desta conta antes de excluí-la." : undefined}
                  onClick={() => setExcluindo(conta)}
                >
                  Excluir
                </Button>
              </div>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-4" aria-label="Resumo da conta">
              <Stat label={cartao ? "Lançado na fatura" : "Saldo hoje"}>
                <Money cents={resumo.saldoCents} strong />
              </Stat>
              <Stat label={cartao ? "Fatura prevista" : "Fim do mês"}>
                <Money cents={resumo.previstoCents} />
              </Stat>
            </dl>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 font-display text-lg font-bold">
                <Button variant="quiet" className="min-w-10 px-0" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>
                  ‹
                </Button>
                <span>
                  {MESES[mes.month - 1]} de {mes.year}
                </span>
                <Button variant="quiet" className="min-w-10 px-0" aria-label="Próximo mês" onClick={() => mudarMes(1)}>
                  ›
                </Button>
              </div>
              <p className="flex items-baseline gap-3 text-sm text-ink-2">
                <span>Início {<Money cents={doMes.saldoInicial} />}</span>
                <span>Fim {<Money cents={doMes.saldoFinal} />}</span>
              </p>
            </div>
            <Troca id={`${conta.id}-${mes.year}-${mes.month}`} direcao={deslize} className="grid min-w-0 gap-4">
              {doMes.movimentos.length === 0 ? (
                <p className="text-sm text-ink-2">Nada nesta conta em {NOME_MES[mes.month - 1]}.</p>
              ) : (
                <List>
                  {doMes.movimentos.map((item) => (
                    <li key={item.chave} className={cn("flex min-w-0 items-start gap-3 border-b border-line px-4 py-3 last:border-b-0", item.pendente && "text-ink-2")}>
                      <time className="w-16 shrink-0 text-sm tabular-nums text-ink-2" dateTime={item.date}>
                        {dataCurta(item.date).slice(0, 5)}
                      </time>
                      <span className="grid min-w-0 flex-1 gap-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 truncate font-medium">{item.descricao}</span>
                          {item.pendente ? <Chip tone="pending">Previsto</Chip> : null}
                        </span>
                        <span className="truncate text-sm text-ink-2">{item.detalhe}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Money cents={item.cents} strong />
                        <span className="text-xs tabular-nums text-ink-2">{<Money cents={item.saldo} />}</span>
                      </span>
                    </li>
                  ))}
                </List>
              )}
            </Troca>

            <div className="grid min-w-0 gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="etiqueta text-ink-2">Extratos desta conta</h3>
                <Link href="/extratos" className={cn("etiqueta-botao text-brand no-underline hover:underline", focusRing)}>
                  Importações
                </Link>
              </div>
              {extratosDaConta.length === 0 ? (
                <p className="text-sm text-ink-2">Nenhum extrato importado nesta conta.</p>
              ) : (
                <List>
                  {extratosDaConta.map((item) => (
                    <li key={item.id} className="flex min-w-0 items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
                      <span className="grid min-w-0 flex-1 gap-1">
                        <span className="truncate font-medium">{item.filename}</span>
                        <span className="text-sm text-ink-2">
                          {item.startDate && item.endDate ? `${dataCurta(item.startDate)} a ${dataCurta(item.endDate)} · ` : ""}
                          {item.lineCount === 1 ? "1 linha" : `${item.lineCount} linhas`}
                        </span>
                      </span>
                      <Chip tone={TOM_DO_EXTRATO[item.status]}>{ROTULO_DO_EXTRATO[item.status]}</Chip>
                    </li>
                  ))}
                </List>
              )}
            </div>
          </section>
        </div>
      ) : null}

      <DialogoDeConta
        pedido={pedido}
        onFechar={() => setPedido(undefined)}
        onSalvo={async (salva) => {
          setEscolhida(salva.id);
          await carregar();
        }}
      />
      <Dialogo aberto={excluindo !== null} aria-labelledby="titulo-excluir-conta" onClose={() => setExcluindo(null)}>
        <div className="dialog-corpo grid gap-4">
          <h2 id="titulo-excluir-conta" className="font-display text-lg">
            Excluir a conta {excluindo?.name}?
          </h2>
          <p>Os lançamentos ligados a ela continuam, mas ficam sem conta. Não pode ser desfeito.</p>
        </div>
        <div className="dialog-acoes">
          <Button variant="quiet" onClick={() => setExcluindo(null)} disabled={ocupado}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={ocupado} onClick={() => excluindo && void excluir(excluindo)}>
            Excluir conta
          </Button>
        </div>
      </Dialogo>
    </PageHeader>
  );
}
