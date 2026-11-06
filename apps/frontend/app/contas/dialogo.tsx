"use client";

import { useState } from "react";
import { ROTULO_DO_TIPO_DE_CONTA, TIPOS_DE_CONTA, type Conta, type TipoDeConta } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { campo, cn } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { api } from "../financas/api";
import { CampoValor } from "../financas/campo-valor";
import { centavosParaReais, reaisParaCentavos } from "../financas/reais";

const field = cn(campo, "w-full");

/** O que o diálogo recebe: a conta a editar, ou `null` para criar. `undefined` fecha. */
export type PedidoDeConta = Conta | null;

/** Cria ou edita uma conta: nome, tipo (conta ou cartão) e o saldo inicial. */
export function DialogoDeConta({
  pedido,
  onFechar,
  onSalvo,
}: {
  pedido: PedidoDeConta | undefined;
  onFechar: () => void;
  onSalvo: (conta: Conta) => Promise<void> | void;
}) {
  return (
    <Dialogo aberto={pedido !== undefined} aria-labelledby="titulo-conta" onClose={onFechar}>
      {pedido !== undefined ? <Corpo key={pedido?.id ?? "nova"} conta={pedido} onFechar={onFechar} onSalvo={onSalvo} /> : null}
    </Dialogo>
  );
}

function Corpo({ conta, onFechar, onSalvo }: { conta: Conta | null; onFechar: () => void; onSalvo: (conta: Conta) => Promise<void> | void }) {
  const toast = useToast();
  const [name, setName] = useState(conta?.name ?? "");
  const [kind, setKind] = useState<TipoDeConta>(conta?.kind ?? "conta");
  const [opening, setOpening] = useState(conta ? centavosParaReais(conta.openingCents) : "");
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    const openingCents = opening.trim() ? reaisParaCentavos(opening) : 0;
    if (openingCents == null) {
      toast.erro("Informe o saldo inicial.");
      return;
    }
    setSalvando(true);
    try {
      const corpo = { name: name.trim(), kind, openingCents };
      const salva = conta
        ? await api<Conta>(`/api/contas/${conta.id}`, { method: "PATCH", body: JSON.stringify(corpo) })
        : await api<Conta>("/api/contas", { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), ...corpo }) });
      toast.sucesso(conta ? "Conta atualizada." : "Conta criada.");
      onFechar();
      await onSalvo(salva);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar a conta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(event) => void salvar(event)}>
      <div className="dialog-corpo grid gap-4">
        <h2 id="titulo-conta" className="font-display text-lg">
          {conta ? "Editar conta" : "Nova conta"}
        </h2>
        <div className="grid gap-1">
          <Rotulo htmlFor="conta-nome" dica="Como você chama esta conta: Nubank, Carteira, Cartão Itaú.">
            Nome
          </Rotulo>
          <input id="conta-nome" className={field} required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="conta-tipo" dica="Conta é banco ou carteira. Cartão de crédito junta as compras na fatura.">
              Tipo
            </Rotulo>
            <select id="conta-tipo" className={field} value={kind} onChange={(event) => setKind(event.target.value as TipoDeConta)}>
              {TIPOS_DE_CONTA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ROTULO_DO_TIPO_DE_CONTA[tipo]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Rotulo
              htmlFor="conta-saldo"
              dica="Quanto havia na conta quando você começou a controlar aqui. No cartão, deixe zero ou o que já está na fatura."
            >
              Saldo inicial
            </Rotulo>
            <CampoValor id="conta-saldo" className={field} value={opening} onChange={setOpening} />
          </div>
        </div>
      </div>
      <div className="dialog-acoes">
        <Button type="button" variant="quiet" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={salvando}>
          {conta ? "Salvar conta" : "Criar conta"}
        </Button>
      </div>
    </form>
  );
}
