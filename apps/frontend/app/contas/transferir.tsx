"use client";

import { useState } from "react";
import type { Conta, ParDeTransferencia } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { campo, cn } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { formatarReais } from "../../components/ui/money";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { api } from "../financas/api";
import { CampoValor } from "../financas/campo-valor";
import { reaisParaCentavos } from "../financas/reais";

const field = cn(campo, "w-full");

/** Move dinheiro entre duas contas: nascem os dois lados da transferência, fora da sobra. */
export function Transferir({
  aberto,
  contas,
  origem,
  hoje,
  onFechar,
  onFeito,
}: {
  aberto: boolean;
  contas: Conta[];
  /** A conta que estava na tela: começa como origem. */
  origem: Conta | null;
  hoje: string;
  onFechar: () => void;
  onFeito: () => Promise<void>;
}) {
  return (
    <Dialogo aberto={aberto} aria-labelledby="titulo-transferir" onClose={onFechar}>
      {aberto ? <Corpo key={origem?.id ?? "x"} contas={contas} origem={origem} hoje={hoje} onFechar={onFechar} onFeito={onFeito} /> : null}
    </Dialogo>
  );
}

function Corpo({ contas, origem, hoje, onFechar, onFeito }: { contas: Conta[]; origem: Conta | null; hoje: string; onFechar: () => void; onFeito: () => Promise<void> }) {
  const toast = useToast();
  const [de, setDe] = useState(origem?.id ?? contas[0]?.id ?? "");
  const [para, setPara] = useState(contas.find((conta) => conta.id !== (origem?.id ?? contas[0]?.id))?.id ?? "");
  const [valor, setValor] = useState("");
  const [date, setDate] = useState(hoje);
  const [note, setNote] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    const cents = reaisParaCentavos(valor);
    if (!de || !para || de === para || cents == null || cents <= 0) {
      toast.erro("Escolha duas contas diferentes e informe o valor.");
      return;
    }
    setSalvando(true);
    try {
      const par = await api<ParDeTransferencia>("/api/contas/transferencias", { method: "POST", body: JSON.stringify({ fromAccountId: de, toAccountId: para, cents, date, note: note.trim() || undefined }) });
      toast.sucesso(`${formatarReais(par.saida.cents)} transferidos. Os dois lados ficaram em Transferências › Entre contas.`);
      onFechar();
      await onFeito();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível transferir.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(event) => void salvar(event)}>
      <div className="dialog-corpo grid gap-4">
        <h2 id="titulo-transferir" className="font-display text-lg">
          Transferir entre contas
        </h2>
        <p className="text-sm text-ink-2">Sai de uma conta e entra na outra. Não mexe na sobra do mês. Apagar um lado apaga o outro.</p>
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="transferir-de" dica="A conta de onde o dinheiro sai.">
              De
            </Rotulo>
            <select id="transferir-de" className={field} value={de} onChange={(event) => setDe(event.target.value)}>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="transferir-para" dica="A conta em que o dinheiro entra. Pode ser um cartão.">
              Para
            </Rotulo>
            <select id="transferir-para" className={field} value={para} onChange={(event) => setPara(event.target.value)}>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id} disabled={conta.id === de}>
                  {conta.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="transferir-valor" dica="Em reais, sem sinal.">
              Valor
            </Rotulo>
            <CampoValor id="transferir-valor" className={field} value={valor} onChange={setValor} />
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="transferir-data" dica="O dia em que o dinheiro mudou de conta.">
              Data
            </Rotulo>
            <input id="transferir-data" type="date" className={field} required value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
        </div>
        <div className="grid gap-1">
          <Rotulo htmlFor="transferir-nota" dica="Opcional: um texto curto, como 'reserva do mês'.">
            Observação
          </Rotulo>
          <input id="transferir-nota" className={field} maxLength={160} value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
      </div>
      <div className="dialog-acoes">
        <Button type="button" variant="quiet" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={salvando || contas.length < 2}>
          Transferir
        </Button>
      </div>
    </form>
  );
}
