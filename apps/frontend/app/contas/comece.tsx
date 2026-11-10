"use client";

import Link from "next/link";
import type { Caixinha, Conta, Extrato } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { cn, focusRing } from "../../components/ui/cn";

type Passo = { titulo: string; texto: string; feito: boolean; opcional?: boolean; acao?: React.ReactNode };

/**
 * O caminho para começar hoje com a conta como está: as contas com o saldo de hoje, o cartão com a fatura em
 * aberto, as caixinhas, e só então os extratos. Some quando já há conta e extrato.
 */
export function ComecePorAqui({
  contas,
  caixinhas,
  extratos,
  onNovaConta,
  onNovoCartao,
}: {
  contas: Conta[];
  caixinhas: Caixinha[];
  extratos: Extrato[];
  onNovaConta: () => void;
  onNovoCartao: () => void;
}) {
  const temConta = contas.some((conta) => conta.kind === "conta");
  const temCartao = contas.some((conta) => conta.kind === "cartao");
  if (temConta && extratos.length > 0) return null;
  const passos: Passo[] = [
    {
      titulo: "A conta do banco",
      texto: "Com o saldo de hoje, copiado do app do banco. Só o que vem depois mexe no saldo.",
      feito: temConta,
      acao: (
        <Button variant={temConta ? "quiet" : "primary"} onClick={onNovaConta}>
          {temConta ? "Outra conta" : "Cadastrar conta"}
        </Button>
      ),
    },
    {
      titulo: "O cartão de crédito",
      texto: "Fechamento, vencimento, limite e o que já está na fatura, em negativo.",
      feito: temCartao,
      opcional: true,
      acao: (
        <Button variant="quiet" onClick={onNovoCartao}>
          {temCartao ? "Outro cartão" : "Cadastrar cartão"}
        </Button>
      ),
    },
    {
      titulo: "As caixinhas",
      texto: "Reserva, CDB, cripto, cada uma na conta dela, na aba Caixinhas. A diferença do saldo vira rendimento.",
      feito: caixinhas.length > 0,
      opcional: true,
    },
    {
      titulo: "Os extratos",
      texto: "O mês atual e, se quiser, os anteriores. Na Conferência, cada linha vira lançamento ou transferência.",
      feito: extratos.length > 0,
      acao: (
        <Link href="/extratos" className={cn("etiqueta-botao inline-flex min-h-10 items-center text-brand no-underline hover:underline", focusRing)}>
          Importar extrato
        </Link>
      ),
    },
  ];
  return (
    <section className="grid min-w-0 gap-3 border border-line bg-surface p-4" aria-labelledby="titulo-comece">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="titulo-comece" className="font-display text-lg">
          Comece por aqui
        </h2>
        <p className="text-sm text-ink-2">Quatro passos para partir de hoje, com a conta como ela está.</p>
      </div>
      <ol className="grid min-w-0 gap-px border border-line bg-line tab:grid-cols-2 desk:grid-cols-4">
        {passos.map((passo, indice) => (
          <li
            key={passo.titulo}
            className={cn(
              "grid min-w-0 content-start gap-2 p-4",
              passo.feito ? "bg-surface-2" : "bg-surface",
            )}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className={cn(
                  "etiqueta inline-flex size-6 shrink-0 items-center justify-center border",
                  passo.feito ? "border-transparent bg-pos-soft text-pos" : "border-line text-ink-2",
                )}
                aria-hidden="true"
              >
                {passo.feito ? "✓" : indice + 1}
              </span>
              <h3 className="min-w-0 text-sm font-semibold">
                <span className="sr-only">Passo {indice + 1}: </span>
                {passo.titulo}
              </h3>
              {passo.feito ? <Chip tone="ok">Feito</Chip> : passo.opcional ? <Chip>Opcional</Chip> : null}
            </div>
            <p className="text-xs text-ink-2">{passo.texto}</p>
            {passo.acao ? <div>{passo.acao}</div> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
