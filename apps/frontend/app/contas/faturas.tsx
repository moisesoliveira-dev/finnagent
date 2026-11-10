"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ROTULO_DO_STATUS_DA_FATURA,
  faturasDoCartao,
  limiteDoCartao,
  type Conta,
  type Fatura,
  type Lancamento,
  type StatusDaFatura,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { BarraDeUso } from "../../components/ui/barra-de-uso";
import { Chip } from "../../components/ui/chip";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { List } from "../../components/ui/list";
import { formatarReais, Money } from "../../components/ui/money";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { api } from "../financas/api";
import { CampoValor } from "../financas/campo-valor";
import { centavosParaReais, reaisParaCentavos } from "../financas/reais";

const field = cn(campo, "w-full");
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const TOM: Record<StatusDaFatura, "ok" | "pending" | "neg" | "info"> = { aberta: "info", fechada: "pending", vencida: "neg", paga: "ok" };

function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** As faturas do cartão (a aberta, as fechadas e as pagas), o limite, e o botão para pagar a partir de uma conta. */
export function Faturas({
  cartao,
  contas,
  entries,
  hoje,
  onMudou,
}: {
  cartao: Conta;
  contas: Conta[];
  entries: Lancamento[];
  hoje: string;
  onMudou: () => Promise<void>;
}) {
  const [pagando, setPagando] = useState<Fatura | null>(null);
  const faturas = [...faturasDoCartao(cartao, entries, hoje)].reverse();
  const limite = limiteDoCartao(cartao, entries, hoje);
  const origens = contas.filter((conta) => conta.kind !== "cartao");
  const nomeDoMes = (month: string) => `${MESES[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;

  if (!cartao.closingDay || !cartao.dueDay) {
    return (
      <div className="grid min-w-0 gap-3">
        <h3>
          <span className="etiqueta text-ink-2">Faturas</span>
        </h3>
        <p className="max-w-prose text-sm text-ink-2">
          Para ver as faturas, informe o dia de fechamento e o dia de vencimento do cartão em Editar. Com eles, cada compra entra na fatura do ciclo dela, e você paga a fatura a partir de uma conta.
        </p>
      </div>
    );
  }

  const [atual, ...anteriores] = faturas;
  const passadas = anteriores.filter((fatura) => fatura.itens > 0 || fatura.totalCents !== 0 || fatura.paidCents > 0);
  const falta = (fatura: Fatura) => Math.max(fatura.totalCents - fatura.paidCents, 0);
  const tomDoLimite = (limite.percent ?? 0) >= 100 ? "neg" : (limite.percent ?? 0) >= 80 ? "pending" : "brand";

  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-sm text-ink-2">
        Fecha dia {cartao.closingDay} · vence dia {cartao.dueDay}
      </p>
      {cartao.limitCents ? (
        <div className="grid min-w-0 gap-2" aria-label="Limite do cartão">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
            <span>
              <span className="font-semibold">{formatarReais(limite.usadoCents)}</span>
              <span className="text-ink-2"> de {formatarReais(cartao.limitCents)}</span>
            </span>
            <span className={cn("text-ink-2", (limite.percent ?? 0) >= 100 && "text-neg")}>
              {formatarReais(limite.disponivelCents ?? 0)} disponível · {limite.percent}%
            </span>
          </div>
          <BarraDeUso percent={limite.percent ?? 0} tom={tomDoLimite} rotulo={`Limite usado: ${limite.percent}%`} />
        </div>
      ) : null}
      {atual ? (
        <section className="grid min-w-0 gap-3 border border-line bg-surface p-4" aria-labelledby="titulo-fatura-atual">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h3 id="titulo-fatura-atual">
              <span className="etiqueta text-ink-2">Fatura de {nomeDoMes(atual.month)}</span>
            </h3>
            <Chip tone={TOM[atual.status]}>{ROTULO_DO_STATUS_DA_FATURA[atual.status]}</Chip>
          </div>
          <span className="font-display text-xl font-bold tracking-titulo">
            <Money cents={-atual.totalCents} />
          </span>
          <p className="text-sm text-ink-2">
            Fecha {dataCurta(atual.closingDate)} · vence {dataCurta(atual.dueDate)} · {atual.itens === 1 ? "1 compra" : `${atual.itens} compras`}
            {atual.paidCents > 0 ? ` · pago ${formatarReais(atual.paidCents)}` : ""}
          </p>
          {atual.status !== "paga" && falta(atual) > 0 ? (
            <div>
              <Button variant="default" onClick={() => setPagando(atual)} disabled={origens.length === 0}>
                {atual.status === "aberta" ? "Pagar antecipado" : "Pagar fatura"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      {passadas.length > 0 ? (
        <div className="grid min-w-0 gap-3">
          <h3>
            <span className="etiqueta text-ink-2">Anteriores</span>
          </h3>
          <List>
            {passadas.map((fatura) => {
              const resta = falta(fatura);
              const pagar = (fatura.status === "fechada" || fatura.status === "vencida") && resta > 0;
              return (
                <li key={fatura.month} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
                  <span className="grid min-w-0 flex-1 basis-full gap-1 tab:basis-0">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{nomeDoMes(fatura.month)}</span>
                      <Chip tone={TOM[fatura.status]}>{ROTULO_DO_STATUS_DA_FATURA[fatura.status]}</Chip>
                    </span>
                    <span className="text-xs text-ink-2">
                      Vence {dataCurta(fatura.dueDate).slice(0, 5)} · {fatura.itens === 1 ? "1 compra" : `${fatura.itens} compras`}
                      {fatura.paidCents > 0 ? ` · pago ${formatarReais(fatura.paidCents)}` : ""}
                      {pagar && resta !== fatura.totalCents ? ` · faltam ${formatarReais(resta)}` : ""}
                    </span>
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-3">
                    <Money cents={-fatura.totalCents} strong />
                    {pagar ? (
                      <Button variant="default" onClick={() => setPagando(fatura)} disabled={origens.length === 0}>
                        Pagar
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </List>
        </div>
      ) : null}
      {origens.length === 0 ? (
        <p className="text-sm text-ink-2">
          Para pagar a fatura, cadastre a conta de onde o dinheiro sai em{" "}
          <Link href="/contas" className={cn("text-brand underline", focusRing)}>
            Nova conta
          </Link>
          .
        </p>
      ) : null}
      <Dialogo aberto={pagando !== null} aria-labelledby="titulo-pagar-fatura" onClose={() => setPagando(null)}>
        {pagando ? <CorpoDoPagamento key={pagando.month} cartao={cartao} fatura={pagando} origens={origens} hoje={hoje} nomeDoMes={nomeDoMes} onFechar={() => setPagando(null)} onPago={onMudou} /> : null}
      </Dialogo>
    </div>
  );
}

function CorpoDoPagamento({
  cartao,
  fatura,
  origens,
  hoje,
  nomeDoMes,
  onFechar,
  onPago,
}: {
  cartao: Conta;
  fatura: Fatura;
  origens: Conta[];
  hoje: string;
  nomeDoMes: (month: string) => string;
  onFechar: () => void;
  onPago: () => Promise<void>;
}) {
  const toast = useToast();
  const falta = Math.max(fatura.totalCents - fatura.paidCents, 0);
  const [fromAccountId, setFromAccountId] = useState(origens[0]?.id ?? "");
  const [valor, setValor] = useState(centavosParaReais(falta));
  const [date, setDate] = useState(hoje);
  const [salvando, setSalvando] = useState(false);

  async function pagar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    const cents = reaisParaCentavos(valor);
    if (cents == null || cents <= 0 || !fromAccountId) {
      toast.erro("Informe a conta e o valor.");
      return;
    }
    setSalvando(true);
    try {
      await api(`/api/contas/${cartao.id}/pagar-fatura`, { method: "POST", body: JSON.stringify({ fromAccountId, cents, date, month: fatura.month }) });
      toast.sucesso(`Fatura de ${nomeDoMes(fatura.month)} paga: ${formatarReais(cents)} saíram da conta e entraram no cartão.`);
      onFechar();
      await onPago();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível pagar a fatura.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(event) => void pagar(event)}>
      <div className="dialog-corpo grid gap-4">
        <h2 id="titulo-pagar-fatura" className="font-display text-lg">
          Pagar a fatura de {nomeDoMes(fatura.month)} · {cartao.name}
        </h2>
        <p className="text-sm text-ink-2">
          O dinheiro sai da conta escolhida e entra no cartão, como transferência: não mexe na sobra do mês, porque cada compra já entrou no dia em que foi feita.
          {fatura.paidCents > 0 ? ` Desta fatura, ${formatarReais(fatura.paidCents)} já foram pagos.` : ""}
        </p>
        <div className="grid gap-1">
          <Rotulo htmlFor="fatura-origem" dica="A conta do banco de onde o pagamento sai.">
            Pagar com
          </Rotulo>
          <select id="fatura-origem" className={field} value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
            {origens.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.name}
              </option>
            ))}
          </select>
        </div>
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="fatura-valor" dica="O total que falta já vem preenchido. Pagamento parcial deixa o resto em aberto.">
              Valor
            </Rotulo>
            <CampoValor id="fatura-valor" className={field} value={valor} onChange={setValor} />
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="fatura-data" dica="O dia em que o pagamento saiu da conta.">
              Data
            </Rotulo>
            <input id="fatura-data" type="date" className={field} required value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
        </div>
      </div>
      <div className="dialog-acoes">
        <Button type="button" variant="quiet" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={salvando}>
          Pagar
        </Button>
      </div>
    </form>
  );
}
