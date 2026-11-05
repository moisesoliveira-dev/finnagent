"use client";

import { useState } from "react";
import {
  ROTULO_DO_TIPO_DE_CONTA,
  TIPOS_DE_CONTA,
  resumoDaConta,
  type Conta,
  type Lancamento,
  type TipoDeConta,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { campo, cn } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { Money } from "../../components/ui/money";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { api } from "./api";
import { CampoValor } from "./campo-valor";
import { centavosParaReais, reaisParaCentavos } from "./reais";

type Rascunho = { id: string | null; name: string; kind: TipoDeConta; opening: string };

const field = cn(campo, "w-full");

/** As contas da pessoa com o saldo de hoje e o previsto para o fim do mês, pelos lançamentos ligados a cada uma. */
export function Contas({
  contas,
  entries,
  hoje,
  onMudou,
}: {
  contas: Conta[];
  entries: Lancamento[];
  hoje: string;
  onMudou: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);

  function abrir(conta?: Conta) {
    setRascunho({
      id: conta?.id ?? null,
      name: conta?.name ?? "",
      kind: conta?.kind ?? "conta",
      opening: conta ? centavosParaReais(conta.openingCents) : "",
    });
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!rascunho || salvando) return;
    const openingCents = rascunho.opening.trim() ? reaisParaCentavos(rascunho.opening) : 0;
    if (openingCents == null) {
      toast.erro("Informe o saldo inicial.");
      return;
    }
    setSalvando(true);
    try {
      const corpo = { name: rascunho.name.trim(), kind: rascunho.kind, openingCents };
      if (rascunho.id) await api(`/api/contas/${rascunho.id}`, { method: "PATCH", body: JSON.stringify(corpo) });
      else await api("/api/contas", { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), ...corpo }) });
      toast.sucesso(rascunho.id ? "Conta atualizada." : "Conta criada.");
      setRascunho(null);
      await onMudou();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar a conta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="grid gap-3" aria-labelledby="titulo-contas">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-contas" className="etiqueta text-ink-2">
          Contas
        </h2>
        <Button variant="quiet" onClick={() => abrir()}>
          Nova conta
        </Button>
      </div>
      {contas.length === 0 ? (
        <p className="text-sm text-ink-2">
          Cadastre a conta do banco e o cartão para ver o saldo de cada um. O extrato importado também cria a conta.
        </p>
      ) : (
        <ul className="grid gap-3 tab:grid-cols-2 desk:grid-cols-3">
          {contas.map((conta) => {
            const resumo = resumoDaConta(conta, entries, hoje);
            const cartao = conta.kind === "cartao";
            return (
              <li key={conta.id}>
                <button
                  type="button"
                  className={cn("grid w-full min-w-0 gap-2 border border-line bg-surface p-4 text-left hover:border-brand")}
                  onClick={() => abrir(conta)}
                  aria-label={`Editar a conta ${conta.name}`}
                >
                  <span className="flex min-w-0 items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{conta.name}</span>
                    <span className="etiqueta shrink-0 text-ink-2">{ROTULO_DO_TIPO_DE_CONTA[conta.kind]}</span>
                  </span>
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-ink-2">{cartao ? "Lançado na fatura" : "Saldo hoje"}</span>
                    <Money cents={resumo.saldoCents} strong />
                  </span>
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-ink-2">{cartao ? "Fatura prevista" : "Fim do mês"}</span>
                    <Money cents={resumo.previstoCents} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialogo aberto={rascunho !== null} aria-labelledby="titulo-conta" onClose={() => setRascunho(null)}>
        <form onSubmit={(event) => void salvar(event)}>
          <div className="dialog-corpo grid gap-4">
            <h2 id="titulo-conta" className="font-display text-lg">
              {rascunho?.id ? "Editar conta" : "Nova conta"}
            </h2>
            <div className="grid gap-1">
              <Rotulo htmlFor="conta-nome" dica="Como você chama esta conta: Nubank, Carteira, Cartão Itaú.">
                Nome
              </Rotulo>
              <input
                id="conta-nome"
                className={field}
                required
                maxLength={80}
                value={rascunho?.name ?? ""}
                onChange={(event) => setRascunho((atual) => (atual ? { ...atual, name: event.target.value } : atual))}
              />
            </div>
            <div className="dialog-par">
              <div className="grid gap-1">
                <Rotulo htmlFor="conta-tipo" dica="Conta é banco ou carteira. Cartão de crédito junta as compras na fatura.">
                  Tipo
                </Rotulo>
                <select
                  id="conta-tipo"
                  className={field}
                  value={rascunho?.kind ?? "conta"}
                  onChange={(event) =>
                    setRascunho((atual) => (atual ? { ...atual, kind: event.target.value as TipoDeConta } : atual))
                  }
                >
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
                <CampoValor
                  id="conta-saldo"
                  className={field}
                  value={rascunho?.opening ?? ""}
                  onChange={(valor) => setRascunho((atual) => (atual ? { ...atual, opening: valor } : atual))}
                />
              </div>
            </div>
          </div>
          <div className="dialog-acoes">
            <Button type="button" variant="quiet" onClick={() => setRascunho(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={salvando}>
              {rascunho?.id ? "Salvar conta" : "Criar conta"}
            </Button>
          </div>
        </form>
      </Dialogo>
    </section>
  );
}
