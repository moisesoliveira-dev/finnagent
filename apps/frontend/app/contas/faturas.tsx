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
import { Chip } from "../../components/ui/chip";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { List } from "../../components/ui/list";
import { formatarReais, Money } from "../../components/ui/money";
import { Rotulo } from "../../components/ui/rotulo";
import { Stat } from "../../components/ui/stat";
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
        <h3 className="etiqueta text-ink-2">Faturas</h3>
        <p className="max-w-prose text-sm text-ink-2">
          Para ver as faturas, informe o dia de fechamento e o dia de vencimento do cartão em Editar. Com eles, cada compra entra na fatura do ciclo dela, e você paga a fatura a partir de uma conta.
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="etiqueta text-ink-2">Faturas</h3>
        <span className="text-sm text-ink-2">
          Fecha dia {cartao.closingDay} · vence dia {cartao.dueDay}
        </span>
      </div>
      {cartao.limitCents ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-4" aria-label="Limite do cartão">
          <Stat label="Limite usado">
            <Money cents={-limite.usadoCents} />
          </Stat>
          <Stat label="Disponível">
            <Money cents={limite.disponivelCents ?? 0} />
          </Stat>
          <Stat label="Do limite">
            <span className={cn((limite.percent ?? 0) >= 100 && "text-neg")}>{limite.percent}%</span>
          </Stat>
        </dl>
      ) : null}
      <List>
        {faturas.map((fatura) => {
          const falta = Math.max(fatura.totalCents - fatura.paidCents, 0);
          return (
            <li key={fatura.month} className="grid min-w-0 gap-2 border-b border-line px-4 py-3 last:border-b-0">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <span className="grid min-w-0 gap-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{nomeDoMes(fatura.month)}</span>
                    <Chip tone={TOM[fatura.status]}>{ROTULO_DO_STATUS_DA_FATURA[fatura.status]}</Chip>
                  </span>
                  <span className="text-sm text-ink-2">
                    Fecha {dataCurta(fatura.closingDate)} · vence {dataCurta(fatura.dueDate)} · {fatura.itens === 1 ? "1 compra" : `${fatura.itens} compras`}
                    {fatura.paidCents > 0 ? ` · pago ${formatarReais(fatura.paidCents)}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Money cents={-fatura.totalCents} strong />
                  {fatura.status !== "paga" && fatura.totalCents > 0 && falta !== fatura.totalCents ? <span className="text-xs text-ink-2">faltam {formatarReais(falta)}</span> : null}
                </span>
              </div>
              {fatura.status !== "paga" && falta > 0 ? (
                <div>
                  <Button variant={fatura.status === "aberta" ? "quiet" : "default"} onClick={() => setPagando(fatura)} disabled={origens.length === 0}>
                    {fatura.status === "aberta" ? "Pagar antecipado" : "Pagar fatura"}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </List>
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
