"use client";

import { useState } from "react";
import type { AjusteDeSaldo, Conta } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { caixaDeMarcar, campo, cn } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { formatarReais } from "../../components/ui/money";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { api } from "../financas/api";
import { CampoValor } from "../financas/campo-valor";
import { reaisParaCentavos } from "../financas/reais";

const field = cn(campo, "w-full");

/**
 * "O banco mostra R$ X": a pessoa digita o saldo do app do banco e o sistema lança a diferença como ajuste, ligado
 * à conta. No cartão, o valor é o da fatura em aberto.
 */
export function ConferirSaldo({
  conta,
  saldoCalculado,
  hoje,
  onFechar,
  onAjustado,
}: {
  conta: Conta | null;
  saldoCalculado: number;
  hoje: string;
  onFechar: () => void;
  onAjustado: () => Promise<void>;
}) {
  return (
    <Dialogo aberto={conta !== null} aria-labelledby="titulo-conferir-saldo" onClose={onFechar}>
      {conta ? <Corpo key={conta.id} conta={conta} saldoCalculado={saldoCalculado} hoje={hoje} onFechar={onFechar} onAjustado={onAjustado} /> : null}
    </Dialogo>
  );
}

function Corpo({
  conta,
  saldoCalculado,
  hoje,
  onFechar,
  onAjustado,
}: {
  conta: Conta;
  saldoCalculado: number;
  hoje: string;
  onFechar: () => void;
  onAjustado: () => Promise<void>;
}) {
  const toast = useToast();
  const cartao = conta.kind === "cartao";
  const [valor, setValor] = useState("");
  const [date, setDate] = useState(hoje);
  const [foraDaSobra, setForaDaSobra] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    const cents = reaisParaCentavos(valor);
    if (cents == null) {
      toast.erro(cartao ? "Informe o valor da fatura." : "Informe o saldo que o banco mostra.");
      return;
    }
    setSalvando(true);
    try {
      // No cartão, a fatura em aberto é o que a conta deve: saldo negativo.
      const saldoCents = cartao ? -Math.abs(cents) : cents;
      const ajuste = await api<AjusteDeSaldo>(`/api/contas/${conta.id}/ajuste`, { method: "POST", body: JSON.stringify({ saldoCents, date, foraDaSobra }) });
      if (ajuste.diferencaCents === 0) toast.sucesso("O saldo já batia. Nada foi lançado.");
      else if (ajuste.comoSaldoInicial) toast.sucesso("O valor ficou como saldo inicial da conta: já estava lá, então não entra nas entradas do mês.");
      else toast.sucesso(`Ajuste de ${formatarReais(ajuste.diferencaCents)} lançado na sessão Ajustes de saldo.`);
      onFechar();
      await onAjustado();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível ajustar o saldo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(event) => void salvar(event)}>
      <div className="dialog-corpo grid gap-4">
        <h2 id="titulo-conferir-saldo" className="font-display text-lg">
          {cartao ? `Conferir a fatura · ${conta.name}` : `Conferir o saldo · ${conta.name}`}
        </h2>
        <p className="text-sm text-ink-2">
          {cartao ? "A fatura em aberto que o app do cartão mostra" : "O saldo que o app do banco mostra"} hoje é comparado com o que o sistema calcula ({formatarReais(saldoCalculado)}). A diferença vira um lançamento de ajuste nesta conta, na sessão Ajustes de saldo. Na primeira vez que você confere, a diferença é o que já estava lá: vira o saldo inicial e não conta no mês.
        </p>
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="conferir-valor" dica={cartao ? "O total da fatura em aberto, sem sinal." : "O saldo como aparece no banco. Negativo se estiver no cheque especial."}>
              {cartao ? "Fatura em aberto" : "O banco mostra"}
            </Rotulo>
            <CampoValor id="conferir-valor" className={field} value={valor} onChange={setValor} />
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="conferir-data" dica="O dia desse saldo. O ajuste é lançado nesse dia.">
              Data
            </Rotulo>
            <input id="conferir-data" type="date" className={field} required value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
        </div>
        <label className="flex min-h-10 items-start gap-2 text-sm">
          <input type="checkbox" className={cn(caixaDeMarcar, "mt-1")} checked={foraDaSobra} onChange={(event) => setForaDaSobra(event.target.checked)} />
          <span>
            Não contar na sobra do mês
            <span className="block text-ink-2">Marque se a diferença não é dinheiro que entrou ou saiu de verdade, como um erro de registro antigo.</span>
          </span>
        </label>
      </div>
      <div className="dialog-acoes">
        <Button type="button" variant="quiet" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={salvando}>
          Ajustar
        </Button>
      </div>
    </form>
  );
}
