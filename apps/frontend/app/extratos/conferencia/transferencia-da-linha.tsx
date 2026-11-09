"use client";

import { useState } from "react";
import type { Conta, ExtratosResposta, LinhaConferencia, TransferenciaDaLinha } from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { campo, cn } from "../../../components/ui/cn";
import { Dialogo } from "../../../components/ui/dialogo";
import { formatarReais } from "../../../components/ui/money";
import { Rotulo } from "../../../components/ui/rotulo";
import { useToast } from "../../../components/ui/toast";
import { api } from "../../financas/api";

const field = cn(campo, "w-full");

/**
 * A linha é uma transferência entre contas da pessoa (Pix para a própria conta, pagamento de fatura, aplicação).
 * A pessoa escolhe a outra conta; o sistema cria os dois lados, cruza esta linha e a linha espelho do outro extrato.
 */
export function TransferenciaDaLinha({ linha, onFechar, onFeito }: { linha: LinhaConferencia | null; onFechar: () => void; onFeito: () => Promise<void> }) {
  return (
    <Dialogo aberto={linha !== null} aria-labelledby="titulo-transferencia-da-linha" onClose={onFechar}>
      {linha ? <Corpo key={`${linha.statementId}:${linha.line}`} linha={linha} onFechar={onFechar} onFeito={onFeito} /> : null}
    </Dialogo>
  );
}

function Corpo({ linha, onFechar, onFeito }: { linha: LinhaConferencia; onFechar: () => void; onFeito: () => Promise<void> }) {
  const toast = useToast();
  const [outras, setOutras] = useState<Conta[] | null>(null);
  const [accountId, setAccountId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const saindo = linha.cents < 0;

  if (outras === null) {
    // As contas, menos a do extrato desta linha. Lido uma vez, ao abrir.
    setOutras([]);
    void api<ExtratosResposta>("/api/extratos")
      .then((resposta) => {
        const minha = resposta.statements.find((item) => item.id === linha.statementId)?.accountId;
        const lista = resposta.accounts.filter((conta) => conta.id !== minha);
        setOutras(lista);
        setAccountId(lista[0]?.id ?? "");
      })
      .catch((error: Error) => toast.erro(error.message));
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando || !accountId) return;
    setSalvando(true);
    try {
      const feito = await api<TransferenciaDaLinha>("/api/extratos/transferir", { method: "POST", body: JSON.stringify({ statementId: linha.statementId, line: linha.line, accountId }) });
      toast.sucesso(feito.espelho ? "Transferência lançada. A linha espelho do outro extrato foi cruzada junto." : "Transferência lançada nos dois lados.");
      onFechar();
      await onFeito();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível marcar a transferência.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(event) => void salvar(event)}>
      <div className="dialog-corpo grid gap-4">
        <h2 id="titulo-transferencia-da-linha" className="font-display text-lg">
          Transferência · {formatarReais(Math.abs(linha.cents))}
        </h2>
        <p className="text-sm text-ink-2">
          {saindo ? "Este valor saiu da conta do extrato e entrou em outra conta sua." : "Este valor entrou na conta do extrato vindo de outra conta sua."} Nascem os dois lados, fora da sobra, e a linha espelho do outro extrato é cruzada se existir (mesmo valor, até três dias de diferença).
        </p>
        <div className="grid gap-1">
          <Rotulo htmlFor="transferencia-conta" dica="A outra conta: banco, carteira ou cartão.">
            {saindo ? "Foi para" : "Veio de"}
          </Rotulo>
          <select id="transferencia-conta" className={field} value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={!outras?.length}>
            {(outras ?? []).map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.name}
              </option>
            ))}
          </select>
          {outras && outras.length === 0 ? <p className="text-sm text-ink-2">Cadastre a outra conta em Contas.</p> : null}
        </div>
      </div>
      <div className="dialog-acoes">
        <Button type="button" variant="quiet" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={salvando || !accountId}>
          Lançar transferência
        </Button>
      </div>
    </form>
  );
}
