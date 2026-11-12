"use client";

import { useState } from "react";
import { fraseDoPlanoDeParcelas, pendentesDaSerie, planoDoPagamentoDeParcelas, type DiferencaDoPagamento, type LancamentoVista } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { campo, cn } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { formatarReais } from "../../components/ui/money";
import { Rotulo } from "../../components/ui/rotulo";
import { Segmentado } from "../../components/ui/segmentado";
import { useToast } from "../../components/ui/toast";
import { api } from "./api";
import { CampoValor } from "./campo-valor";
import { centavosParaReais, doisDigitos, reaisParaCentavos } from "./reais";

const field = cn(campo, "w-full");

function hoje() {
  const agora = new Date();
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
}

/** O último pagamento registrado no lançamento, pela data: é o que "Desfazer último pagamento" desfaz. */
export function ultimoPagamento(entry: Pick<LancamentoVista, "occurrences">) {
  const pagas = entry.occurrences.filter((item) => item.status === "completed" && item.paymentId);
  pagas.sort((a, b) => (b.paidOn ?? b.dueDate).localeCompare(a.paidOn ?? a.dueDate) || b.number - a.number);
  return pagas[0]?.paymentId ?? null;
}

/** O que falta pagar: na parcela, a soma das pendentes; no empréstimo, o saldo do contrato. */
export function faltaPagar(entry: Pick<LancamentoVista, "occurrences" | "category" | "cents" | "installments" | "principalCents">) {
  if (entry.category === "loan") {
    const principal = Math.abs(entry.principalCents ?? Math.abs(entry.cents) * (entry.installments ?? 1));
    const pago = entry.occurrences
      .filter((item) => item.status === "completed" && item.kind !== "multa")
      .reduce((soma, item) => soma + Math.abs(item.paidCents ?? item.plannedCents), 0);
    return Math.max(principal - pago, 0);
  }
  return entry.occurrences.filter((item) => item.status === "pending").reduce((soma, item) => soma + Math.abs(item.plannedCents), 0);
}

/**
 * Registra um pagamento numa parcela ou num empréstimo: a data e o valor reais. Na parcela, quando o valor passa
 * de uma e não chega a outra, a pessoa diz se a sobra é multa e juros ou parte da próxima.
 */
export function DialogoDePagamento({
  entry,
  quitar = false,
  onFechar,
  onPago,
}: {
  entry: LancamentoVista | null;
  /** Abre com o valor que falta preenchido. */
  quitar?: boolean;
  onFechar: () => void;
  onPago: () => Promise<void>;
}) {
  return (
    <Dialogo aberto={entry !== null} aria-labelledby="titulo-pagamento" onClose={onFechar}>
      {entry ? <Corpo key={`${entry.id}:${quitar}`} entry={entry} quitar={quitar} onFechar={onFechar} onPago={onPago} /> : null}
    </Dialogo>
  );
}

function Corpo({
  entry,
  quitar,
  onFechar,
  onPago,
}: {
  entry: LancamentoVista;
  quitar: boolean;
  onFechar: () => void;
  onPago: () => Promise<void>;
}) {
  const toast = useToast();
  const falta = faltaPagar(entry);
  const proxima = entry.occurrences.filter((item) => item.status === "pending")[0] ?? null;
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState(quitar ? centavosParaReais(falta) : proxima ? centavosParaReais(Math.abs(proxima.plannedCents)) : "");
  const [diferenca, setDiferenca] = useState<DiferencaDoPagamento | "">("");
  const [salvando, setSalvando] = useState(false);
  const cents = reaisParaCentavos(valor);
  const parcela = entry.category === "installment";
  // Quantas parcelas o valor paga, de uma vez: duas parcelas do mesmo mês cabem num pagamento só. A pergunta da
  // sobra só vem quando sobra algo depois das parcelas inteiras e ainda há outra pendente.
  const plano = parcela && cents !== null ? planoDoPagamentoDeParcelas(pendentesDaSerie(entry.occurrences), cents) : null;
  const pedeDiferenca = Boolean(plano?.pedeDiferenca);
  const frase = plano ? fraseDoPlanoDeParcelas(plano, formatarReais) : "";
  // Atalho: o valor de 1, 2 ou 3 parcelas de uma vez, sem fazer a conta.
  const pendentes = parcela ? pendentesDaSerie(entry.occurrences) : [];
  const somaDe = (quantas: number) => pendentes.slice(0, quantas).reduce((total, item) => total + item, 0);
  const quantasPagas = plano && cents !== null && plano.sobraCents === 0 && plano.inteiras > 0 ? String(plano.inteiras) : "";

  async function pagar(event: React.FormEvent) {
    event.preventDefault();
    if (cents === null || salvando) return;
    if (pedeDiferenca && !diferenca) {
      toast.erro("Diga se a sobra é multa e juros ou parte da próxima parcela.");
      return;
    }
    setSalvando(true);
    try {
      await api(`/api/lancamentos/${entry.id}/pagamentos`, {
        method: "POST",
        body: JSON.stringify({ date: data, cents, ...(pedeDiferenca && diferenca ? { diferenca } : {}) }),
      });
      toast.sucesso(entry.category === "loan" ? "Pagamento registrado no empréstimo." : "Pagamento registrado nas parcelas.");
      onFechar();
      await onPago();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível registrar o pagamento.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(event) => void pagar(event)}>
      <div className="dialog-corpo grid gap-4">
        <div className="grid gap-1">
          <h2 id="titulo-pagamento" className="font-display text-lg">
            {quitar ? "Quitar" : "Registrar pagamento"}
          </h2>
          <p className="text-sm text-ink-2">
            {entry.name || entry.description}
            {entry.counterparty ? ` · ${entry.counterparty}` : ""}. Falta {formatarReais(falta)}
            {proxima ? `; a próxima parcela é ${formatarReais(Math.abs(proxima.plannedCents))}.` : "."}
          </p>
        </div>
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="pagamento-data" dica="O dia em que o dinheiro saiu ou entrou.">
              Data
            </Rotulo>
            <input id="pagamento-data" type="date" required value={data} onChange={(event) => setData(event.target.value)} className={field} />
          </div>
          <div className="grid gap-1">
            <Rotulo
              htmlFor="pagamento-valor"
              dica={
                parcela
                  ? "O valor pago. Duas parcelas do mesmo mês cabem num pagamento só: o valor de duas paga as duas. Menos que uma paga parte dela."
                  : "O valor pago. Abate o saldo; o que falta é previsto de novo."
              }
            >
              Valor
            </Rotulo>
            <CampoValor id="pagamento-valor" className={field} required value={valor} onChange={setValor} />
          </div>
        </div>
        {parcela && pendentes.length > 1 ? (
          <div className="grid gap-1">
            <span className="etiqueta text-ink-2">Quantas parcelas pagar</span>
            <Segmentado<string>
              aria-label="Quantas parcelas pagar"
              opcoes={[1, 2, 3].filter((quantas) => quantas <= pendentes.length).map((quantas) => ({ id: String(quantas), label: quantas === 1 ? "1 parcela" : `${quantas} parcelas` }))}
              valor={quantasPagas}
              onEscolher={(id) => {
                if (id) setValor(centavosParaReais(somaDe(Number(id))));
              }}
            />
          </div>
        ) : null}
        {frase ? <p className="text-sm text-ink-2">{frase}</p> : null}
        {pedeDiferenca ? (
          <div className="grid gap-2 border border-pending-line bg-pending-soft p-3">
            <span className="text-sm text-pending">
              {plano ? `Depois das parcelas inteiras sobram ${formatarReais(plano.sobraCents)}.` : ""} O que é a sobra?
            </span>
            <Segmentado<"" | DiferencaDoPagamento>
              aria-label="A sobra do pagamento"
              opcoes={[
                { id: "multa", label: "Multa e juros" },
                { id: "proxima", label: "Parte da próxima" },
              ]}
              valor={diferenca}
              onEscolher={(id) => {
                if (id) setDiferenca(id);
              }}
            />
          </div>
        ) : null}
      </div>
      <div className="dialog-acoes">
        <Button type="button" variant="quiet" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={salvando || cents === null}>
          {salvando ? "Registrando" : "Registrar"}
        </Button>
      </div>
    </form>
  );
}
