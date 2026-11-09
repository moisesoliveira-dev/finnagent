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
      titulo: "A conta do banco, com o saldo de hoje",
      texto: "Abra o app do banco e copie o saldo. Só o que acontecer a partir de hoje conta no saldo; extratos antigos entram na sobra e no histórico sem dobrar.",
      feito: temConta,
      acao: (
        <Button variant={temConta ? "quiet" : "primary"} onClick={onNovaConta}>
          {temConta ? "Outra conta" : "Cadastrar a conta"}
        </Button>
      ),
    },
    {
      titulo: "O cartão de crédito, com a fatura em aberto",
      texto: "O dia em que fecha, o dia em que vence, o limite, e o que já está na fatura (em negativo). Cada compra entra na fatura do ciclo dela, e você paga a fatura a partir da conta.",
      feito: temCartao,
      opcional: true,
      acao: (
        <Button variant="quiet" onClick={onNovoCartao}>
          {temCartao ? "Outro cartão" : "Cadastrar o cartão"}
        </Button>
      ),
    },
    {
      titulo: "As caixinhas, com o que já está guardado",
      texto: "Reserva, CDB, cripto: cada uma na conta dela, em Caixinhas desta conta. Depois é só informar o saldo de vez em quando; a diferença vira rendimento.",
      feito: caixinhas.length > 0,
      opcional: true,
    },
    {
      titulo: "Os extratos",
      texto: "Importe o mês atual e, se quiser, os anteriores. Na Conferência, cada linha vira lançamento, transferência ou é ignorada. O saldo da conta só muda com o que é de hoje em diante.",
      feito: extratos.length > 0,
      acao: (
        <Link href="/extratos" className={cn("etiqueta-botao inline-flex min-h-10 items-center text-brand no-underline hover:underline", focusRing)}>
          Importar extrato
        </Link>
      ),
    },
  ];
  return (
    <section className="grid min-w-0 gap-4 border border-line bg-surface p-4" aria-labelledby="titulo-comece">
      <div className="grid gap-1">
        <h2 id="titulo-comece" className="font-display text-lg">
          Comece por aqui
        </h2>
        <p className="max-w-prose text-sm text-ink-2">Quatro passos para partir de hoje, com a conta como ela está, sem perder o controle do que vem depois.</p>
      </div>
      <ol className="grid gap-3">
        {passos.map((passo, indice) => (
          <li key={passo.titulo} className={cn("grid min-w-0 gap-2 border border-line p-4", passo.feito && "bg-surface-2")}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="etiqueta text-ink-2">Passo {indice + 1}</span>
              {passo.feito ? <Chip tone="ok">Feito</Chip> : passo.opcional ? <Chip>Opcional</Chip> : null}
            </div>
            <h3 className="font-medium">{passo.titulo}</h3>
            <p className="max-w-prose text-sm text-ink-2">{passo.texto}</p>
            {passo.acao ? <div>{passo.acao}</div> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
