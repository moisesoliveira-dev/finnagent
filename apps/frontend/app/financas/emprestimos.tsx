"use client";

import { useState } from "react";
import { type LancamentoVista } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { Money } from "../../components/ui/money";
import { useToast } from "../../components/ui/toast";
import { api } from "./api";
import { DialogoDePagamento, faltaPagar, ultimoPagamento } from "./pagamento";

function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

type Pedido = { entry: LancamentoVista; quitar: boolean };

/**
 * Os empréstimos como contratos: quem, o total, o que já foi pago e o que falta, em "Devo" (saídas) e "Me devem"
 * (entradas). Daqui a pessoa registra um pagamento, quita ou desfaz o último pagamento.
 */
export function Emprestimos({ entries, onMudou }: { entries: LancamentoVista[]; onMudou: () => Promise<void> }) {
  const toast = useToast();
  const [pagando, setPagando] = useState<Pedido | null>(null);
  const [ocupado, setOcupado] = useState("");
  const emprestimos = entries.filter((entry) => entry.category === "loan" && entry.status !== "cancelled");
  if (emprestimos.length === 0) return null;

  async function desfazer(entry: LancamentoVista) {
    const paymentId = ultimoPagamento(entry);
    if (!paymentId) return;
    setOcupado(entry.id);
    try {
      await api(`/api/lancamentos/${entry.id}/pagamentos/${paymentId}`, { method: "DELETE" });
      toast.sucesso("Último pagamento desfeito.");
      await onMudou();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível desfazer o pagamento.");
    } finally {
      setOcupado("");
    }
  }

  const lista = (titulo: string, itens: LancamentoVista[]) =>
    itens.length === 0 ? null : (
      <div className="grid gap-3">
        <h3 className="etiqueta text-ink-2">{titulo}</h3>
        <ul className="grid gap-3 tab:grid-cols-2 desk:grid-cols-3">
          {itens.map((entry) => (
            <Cartao key={entry.id} entry={entry} ocupado={ocupado} onPagar={setPagando} onDesfazer={desfazer} />
          ))}
        </ul>
      </div>
    );

  return (
    <section className="grid gap-4" aria-labelledby="titulo-emprestimos">
      <h2 id="titulo-emprestimos" className="etiqueta text-ink-2">
        Empréstimos
      </h2>
      {lista("Devo", emprestimos.filter((entry) => entry.mode === "outflows"))}
      {lista("Me devem", emprestimos.filter((entry) => entry.mode === "inflows"))}
      <DialogoDePagamento
        entry={pagando?.entry ?? null}
        quitar={pagando?.quitar ?? false}
        onFechar={() => setPagando(null)}
        onPago={onMudou}
      />
    </section>
  );
}

function Cartao({
  entry,
  ocupado,
  onPagar,
  onDesfazer,
}: {
  entry: LancamentoVista;
  ocupado: string;
  onPagar: (pedido: Pedido) => void;
  onDesfazer: (entry: LancamentoVista) => Promise<void>;
}) {
  const falta = faltaPagar(entry);
  const principal = Math.abs(entry.principalCents ?? Math.abs(entry.cents) * (entry.installments ?? 1));
  const pago = principal - falta;
  const quitado = falta === 0;
  const proxima = entry.occurrences.filter((item) => item.status === "pending")[0] ?? null;
  const sinal = entry.mode === "outflows" ? -1 : 1;
  return (
    <li className="grid min-w-0 gap-3 border border-line bg-surface p-4">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{entry.counterparty || entry.name}</span>
        {quitado ? (
          <Chip tone="ok">Quitado</Chip>
        ) : entry.situation === "late" ? (
          <Chip tone="neg">Sem pagamento</Chip>
        ) : (
          <Chip tone="event">Em aberto</Chip>
        )}
      </div>
      <dl className="grid gap-1 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-ink-2">Total</dt>
          <dd>
            <Money cents={sinal * principal} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-ink-2">Pago</dt>
          <dd>
            <Money cents={sinal * pago} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-ink-2">Falta</dt>
          <dd>
            <Money cents={sinal * falta} strong />
          </dd>
        </div>
        {proxima ? (
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-ink-2">Previsto</dt>
            <dd className="flex items-baseline gap-2 text-ink-2">
              <span>{dataCurta(proxima.dueDate)}</span>
              <Money cents={proxima.plannedCents} />
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-2">
        {quitado ? null : (
          <>
            <Button variant="default" disabled={ocupado !== ""} onClick={() => onPagar({ entry, quitar: false })}>
              Pagar
            </Button>
            <Button variant="quiet" disabled={ocupado !== ""} onClick={() => onPagar({ entry, quitar: true })}>
              Quitar
            </Button>
          </>
        )}
        {ultimoPagamento(entry) ? (
          <Button variant="quiet" carregando={ocupado === entry.id} disabled={ocupado !== ""} onClick={() => void onDesfazer(entry)}>
            Desfazer último pagamento
          </Button>
        ) : null}
      </div>
    </li>
  );
}
