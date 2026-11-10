"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  NOME_MES,
  ROTULO_DO_TIPO_DE_CONTA,
  faturasDoCartao,
  limiteDoCartao,
  movimentosDoMes,
  resumoDaConta,
  type Conta,
  type ContasResposta,
  type Extrato,
  type ExtratosResposta,
  type FinancasVista,
  type Lancamento,
  type LancamentoVista,
  type TipoDeConta,
  type Caixinha,
  type Meta,
  type MetasResposta,
  resumoDaCaixinha,
} from "@finnagent/contracts";
import { BarraDeUso } from "../../components/ui/barra-de-uso";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { cn, focusRing } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { Carregando } from "../../components/ui/esqueleto";
import { List } from "../../components/ui/list";
import { formatarReais, Money } from "../../components/ui/money";
import { Troca } from "../../components/ui/movimento";
import { PageHeader } from "../../components/ui/page-header";
import { Segmentado } from "../../components/ui/segmentado";
import { Stat } from "../../components/ui/stat";
import { useToast } from "../../components/ui/toast";
import { api } from "../financas/api";
import { SecaoDeCaixinhas } from "./caixinhas";
import { ComecePorAqui } from "./comece";
import { ConferirSaldo } from "./conferir-saldo";
import { DialogoDeConta, type PedidoDeConta } from "./dialogo";
import { Faturas } from "./faturas";
import { Patrimonio } from "./patrimonio";
import { Transferir } from "./transferir";

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

type Aba = "movimentos" | "caixinhas" | "faturas" | "extratos";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Contas() {
  const toast = useToast();
  const hoje = hojeIso();
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [caixinhas, setCaixinhas] = useState<Caixinha[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [entries, setEntries] = useState<LancamentoVista[]>([]);
  const [extratos, setExtratos] = useState<Extrato[]>([]);
  const [falhou, setFalhou] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [mes, setMes] = useState({ year: Number(hoje.slice(0, 4)), month: Number(hoje.slice(5, 7)) });
  const [deslize, setDeslize] = useState(0);
  const [pedido, setPedido] = useState<PedidoDeConta | undefined>(undefined);
  const [tipoInicial, setTipoInicial] = useState<TipoDeConta>("conta");
  const [excluindo, setExcluindo] = useState<Conta | null>(null);
  const [conferindo, setConferindo] = useState<Conta | null>(null);
  const [transferindo, setTransferindo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aba, setAba] = useState<Aba>("movimentos");
  const [deslizeDaAba, setDeslizeDaAba] = useState(0);

  const buscar = useCallback(
    () =>
      Promise.all([
        api<ContasResposta>("/api/contas"),
        api<FinancasVista>("/api/financas"),
        api<ExtratosResposta>("/api/extratos").catch(() => ({ accounts: [], statements: [] }) as ExtratosResposta),
        api<MetasResposta>("/api/metas").then((resposta) => resposta.goals).catch(() => [] as Meta[]),
      ]),
    [],
  );

  useEffect(() => {
    let ativo = true;
    buscar()
      .then(([c, f, e, m]) => {
        if (!ativo) return;
        setContas(c.accounts);
        setCaixinhas(c.boxes ?? []);
        setMetas(m);
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
      const [c, f, e, m] = await buscar();
      setContas(c.accounts);
      setCaixinhas(c.boxes ?? []);
      setMetas(m);
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
  const noDepositoDe = (alvo: Conta) =>
    caixinhas.filter((item) => item.accountId === alvo.id).reduce((soma, item) => soma + resumoDaCaixinha(item, entries, hoje).saldoCents, 0);
  const temCaixinha = (alvo: Conta) => caixinhas.some((item) => item.accountId === alvo.id);
  const grupos = contas
    ? [
        { titulo: "Contas", contas: contas.filter((item) => item.kind !== "cartao") },
        { titulo: "Cartões", contas: contas.filter((item) => item.kind === "cartao") },
      ].filter((grupo) => grupo.contas.length > 0)
    : [];
  const abas: { id: Aba; label: string }[] = [
    { id: "movimentos", label: "Movimentos" },
    cartao ? { id: "faturas", label: "Faturas" } : { id: "caixinhas", label: "Caixinhas" },
    { id: "extratos", label: "Extratos" },
  ];
  // A aba que não existe neste tipo de conta (Caixinhas no cartão, Faturas na conta) volta para Movimentos.
  const abaAtual: Aba = abas.some((item) => item.id === aba) ? aba : "movimentos";

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
        <div className="flex flex-wrap gap-2">
          {contas && contas.length >= 2 ? (
            <Button variant="default" onClick={() => setTransferindo(true)}>
              Transferir
            </Button>
          ) : null}
          <Button
            variant="default"
            onClick={() => {
              setTipoInicial("conta");
              setPedido(null);
            }}
          >
            Nova conta
          </Button>
        </div>
      }
    >
      {!contas && !falhou ? <Carregando texto="Carregando as contas." titulo linhas={4} /> : null}
      {contas ? (
        <div className="mb-6 empty:hidden">
          <ComecePorAqui
            contas={contas}
            caixinhas={caixinhas}
            extratos={extratos}
            onNovaConta={() => {
              setTipoInicial("conta");
              setPedido(null);
            }}
            onNovoCartao={() => {
              setTipoInicial("cartao");
              setPedido(null);
            }}
          />
        </div>
      ) : null}
      {contas && contas.length > 0 ? (
        <div className="mb-6">
          <Patrimonio contas={contas} caixinhas={caixinhas} entries={entries} hoje={hoje} />
        </div>
      ) : null}
      {contas && conta && resumo && doMes ? (
        <div className="grid min-w-0 gap-6 desk:grid-cols-5">
          <nav className="grid min-w-0 content-start gap-6 desk:col-span-2" aria-label="Suas contas">
            {grupos.map((grupo) => (
              <div key={grupo.titulo} className="grid min-w-0 gap-3">
                <h2>
                  <span className="etiqueta text-ink-2">{grupo.titulo}</span>
                </h2>
                <List>
                  {grupo.contas.map((item) => (
                    <li key={item.id} className="border-b border-line last:border-b-0">
                      <LinhaDaConta
                        conta={item}
                        atual={item.id === conta.id}
                        entries={entries}
                        hoje={hoje}
                        caixinhas={caixinhas.filter((caixinha) => caixinha.accountId === item.id).length}
                        guardado={noDepositoDe(item)}
                        onEscolher={() => {
                          setEscolhida(item.id);
                          setDeslize(0);
                        }}
                      />
                    </li>
                  ))}
                </List>
              </div>
            ))}
          </nav>

          <section className="grid min-w-0 content-start gap-6 desk:col-span-3" aria-labelledby="titulo-da-conta">
            <div className="grid min-w-0 gap-4 border border-line bg-surface p-4">
              <div className="grid min-w-0 gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 id="titulo-da-conta" className="min-w-0 truncate font-display text-lg">
                    {conta.name}
                  </h2>
                  <Chip tone={cartao ? "event" : "info"}>{ROTULO_DO_TIPO_DE_CONTA[conta.kind]}</Chip>
                </div>
                <p className="text-xs text-ink-2">
                  Saldo inicial {formatarReais(conta.openingCents)}
                  {conta.openingOn ? ` em ${dataCurta(conta.openingOn)}` : " · sem data: tudo conta"}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-4 tab:flex tab:flex-wrap tab:gap-x-8" aria-label="Resumo da conta">
                <Stat label={cartao ? "Lançado na fatura" : "Saldo hoje"}>
                  <Money cents={resumo.saldoCents} strong />
                </Stat>
                <Stat label={cartao ? "Fatura prevista" : "Fim do mês"}>
                  <Money cents={resumo.previstoCents} />
                </Stat>
                {temCaixinha(conta) ? (
                  <>
                    <Stat label="Nas caixinhas">
                      <Money cents={noDepositoDe(conta)} />
                    </Stat>
                    <Stat label="Conta e caixinhas">
                      <Money cents={resumo.saldoCents + noDepositoDe(conta)} />
                    </Stat>
                  </>
                ) : null}
              </dl>
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                <Button variant="primary" onClick={() => setConferindo(conta)}>
                  {cartao ? "Conferir fatura" : "Conferir saldo"}
                </Button>
                <Button variant="default" onClick={() => setPedido(conta)}>
                  Editar
                </Button>
                <Button
                  variant="quiet"
                  disabled={extratosDaConta.length > 0 || temCaixinha(conta)}
                  title={
                    extratosDaConta.length > 0
                      ? "Apague os extratos desta conta antes de excluí-la."
                      : temCaixinha(conta)
                        ? "Exclua as caixinhas desta conta antes de excluí-la."
                        : undefined
                  }
                  onClick={() => setExcluindo(conta)}
                >
                  Excluir
                </Button>
              </div>
            </div>

            <div className="grid min-w-0 gap-4">
              <Segmentado
                aria-label="O que ver da conta"
                opcoes={abas}
                valor={abaAtual}
                onEscolher={(id, direcao) => {
                  setDeslizeDaAba(direcao);
                  setAba(id);
                }}
              />
              <Troca id={`${conta.id}-${abaAtual}`} direcao={deslizeDaAba} className="grid min-w-0 gap-4">
                {abaAtual === "movimentos" ? (
                  <>
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
                            <li
                              key={item.chave}
                              className={cn("flex min-w-0 items-start gap-3 border-b border-line px-4 py-3 last:border-b-0", (item.pendente || item.foraDoSaldo) && "text-ink-2")}
                            >
                              <time className="w-12 shrink-0 pt-1 text-xs tabular-nums text-ink-2" dateTime={item.date}>
                                {dataCurta(item.date).slice(0, 5)}
                              </time>
                              <span className="grid min-w-0 flex-1 gap-1">
                                <span className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="min-w-0 truncate font-medium">{item.descricao}</span>
                                  {item.pendente ? <Chip tone="pending">Previsto</Chip> : null}
                                  {item.foraDoSaldo ? <Chip>Antes do saldo inicial</Chip> : null}
                                </span>
                                <span className="truncate text-xs text-ink-2">{item.detalhe}</span>
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
                  </>
                ) : null}
                {abaAtual === "caixinhas" ? (
                  <SecaoDeCaixinhas conta={conta} caixinhas={caixinhas} entries={entries} metas={metas} hoje={hoje} mes={mes} onMudou={carregar} />
                ) : null}
                {abaAtual === "faturas" ? <Faturas cartao={conta} contas={contas} entries={entries} hoje={hoje} onMudou={carregar} /> : null}
                {abaAtual === "extratos" ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-ink-2">
                        {extratosDaConta.length === 0
                          ? "Nenhum extrato importado nesta conta."
                          : extratosDaConta.length === 1
                            ? "1 extrato importado nesta conta."
                            : `${extratosDaConta.length} extratos importados nesta conta.`}
                      </p>
                      <Link href="/extratos" className={cn("etiqueta-botao inline-flex min-h-10 items-center text-brand no-underline hover:underline", focusRing)}>
                        Importações
                      </Link>
                    </div>
                    {extratosDaConta.length > 0 ? (
                      <List>
                        {extratosDaConta.map((item) => (
                          <li key={item.id} className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                            <span className="grid min-w-0 flex-1 gap-1">
                              <span className="truncate text-sm font-medium">{item.filename}</span>
                              <span className="text-xs text-ink-2">
                                {item.startDate && item.endDate ? `${dataCurta(item.startDate)} a ${dataCurta(item.endDate)} · ` : ""}
                                {item.lineCount === 1 ? "1 linha" : `${item.lineCount} linhas`}
                              </span>
                            </span>
                            <Chip tone={TOM_DO_EXTRATO[item.status]}>{ROTULO_DO_EXTRATO[item.status]}</Chip>
                          </li>
                        ))}
                      </List>
                    ) : null}
                  </>
                ) : null}
              </Troca>
            </div>
          </section>
        </div>
      ) : null}

      <Transferir aberto={transferindo} contas={contas ?? []} origem={conta} hoje={hoje} onFechar={() => setTransferindo(false)} onFeito={carregar} />
      <ConferirSaldo conta={conferindo} saldoCalculado={conferindo ? resumoDaConta(conferindo, entries, hoje).saldoCents : 0} hoje={hoje} onFechar={() => setConferindo(null)} onAjustado={carregar} />
      <DialogoDeConta
        pedido={pedido}
        hoje={hoje}
        tipoInicial={tipoInicial}
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

/** Uma linha da lista de contas: nome e saldo, e embaixo as caixinhas (conta) ou a fatura e o limite (cartão). */
function LinhaDaConta({
  conta,
  atual,
  entries,
  hoje,
  caixinhas,
  guardado,
  onEscolher,
}: {
  conta: Conta;
  atual: boolean;
  entries: Lancamento[];
  hoje: string;
  caixinhas: number;
  guardado: number;
  onEscolher: () => void;
}) {
  const saldo = resumoDaConta(conta, entries, hoje).saldoCents;
  const fatura = conta.kind === "cartao" ? faturasDoCartao(conta, entries, hoje).at(-1) : undefined;
  const limite = conta.kind === "cartao" && conta.limitCents ? limiteDoCartao(conta, entries, hoje) : null;
  const detalhe =
    conta.kind === "cartao"
      ? fatura
        ? `Fatura de ${NOME_MES[Number(fatura.month.slice(5, 7)) - 1]} · vence ${dataCurta(fatura.dueDate).slice(0, 5)}`
        : "Sem dia de fechamento e vencimento"
      : caixinhas > 0
        ? `${caixinhas === 1 ? "1 caixinha" : `${caixinhas} caixinhas`} · ${formatarReais(guardado)} guardado`
        : "Saldo hoje";
  return (
    <button
      type="button"
      aria-pressed={atual}
      onClick={onEscolher}
      className={cn(
        "grid w-full min-w-0 gap-1 border-l-4 px-4 py-3 text-left transition-colors",
        atual ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface-2",
        focusRing,
      )}
    >
      <span className="flex min-w-0 items-baseline justify-between gap-3">
        <span className={cn("min-w-0 truncate font-medium", atual && "text-brand")}>{conta.name}</span>
        <span className="shrink-0">
          <Money cents={saldo} strong />
        </span>
      </span>
      <span className="truncate text-xs text-ink-2">{detalhe}</span>
      {limite && limite.percent !== null ? (
        <BarraDeUso
          percent={limite.percent}
          tom={limite.percent >= 100 ? "neg" : limite.percent >= 80 ? "pending" : "brand"}
          rotulo={`Limite usado: ${limite.percent}%`}
        />
      ) : null}
    </button>
  );
}
