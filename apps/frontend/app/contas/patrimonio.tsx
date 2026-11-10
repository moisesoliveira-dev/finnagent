"use client";

import { useState } from "react";
import { NOME_MES, evolucaoDoPatrimonio, patrimonio, type Caixinha, type Conta, type Lancamento } from "@finnagent/contracts";
import { BarrasCompactas } from "../../components/ui/barras";
import { Money } from "../../components/ui/money";

/** O que a pessoa tem hoje, somando contas e caixinhas e descontando os cartões, e como isso andou nos últimos meses. */
export function Patrimonio({ contas, caixinhas, entries, hoje }: { contas: Conta[]; caixinhas: Caixinha[]; entries: Lancamento[]; hoje: string }) {
  const atual = patrimonio(contas, caixinhas, entries, hoje);
  const evolucao = evolucaoDoPatrimonio(contas, caixinhas, entries, hoje, 6);
  const [ativo, setAtivo] = useState(hoje.slice(0, 7));
  const barras = evolucao.map((mes) => ({
    id: mes.month,
    curto: NOME_MES[Number(mes.month.slice(5, 7)) - 1]?.slice(0, 3) ?? mes.month,
    rotulo: `${NOME_MES[Number(mes.month.slice(5, 7)) - 1]} de ${mes.month.slice(0, 4)}`,
    cents: mes.totalCents,
  }));
  const anterior = evolucao.at(-2);
  const variacao = anterior ? atual.totalCents - anterior.totalCents : null;
  const nomeDoAnterior = anterior ? NOME_MES[Number(anterior.month.slice(5, 7)) - 1] : "";
  const temCaixinha = caixinhas.length > 0;
  const temCartao = contas.some((conta) => conta.kind === "cartao");

  return (
    <section className="grid min-w-0 gap-6 border border-line bg-surface p-4 desk:grid-cols-2 desk:items-end" aria-labelledby="titulo-patrimonio">
      <div className="grid min-w-0 content-start gap-2">
        <h2 id="titulo-patrimonio">
          <span className="etiqueta text-ink-2">Patrimônio hoje</span>
        </h2>
        <p className="font-display text-xl font-bold tracking-titulo tab:text-2xl">
          <Money cents={atual.totalCents} />
        </p>
        {variacao !== null ? (
          <p className="flex flex-wrap items-baseline gap-2 text-sm">
            <Money cents={variacao} strong />
            <span className="text-ink-2">desde o fim de {nomeDoAnterior}</span>
          </p>
        ) : null}
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="De onde vem o patrimônio">
          <div className="flex items-baseline gap-2">
            <dt className="text-ink-2">Contas</dt>
            <dd>
              <Money cents={atual.contasCents} />
            </dd>
          </div>
          {temCaixinha ? (
            <div className="flex items-baseline gap-2">
              <dt className="text-ink-2">Caixinhas</dt>
              <dd>
                <Money cents={atual.caixinhasCents} />
              </dd>
            </div>
          ) : null}
          {temCartao ? (
            <div className="flex items-baseline gap-2">
              <dt className="text-ink-2">Cartões</dt>
              <dd>
                <Money cents={-atual.cartoesCents} />
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      <BarrasCompactas barras={barras} ativo={ativo} onEscolher={setAtivo} ariaLabel="Patrimônio no fim de cada um dos últimos seis meses" />
    </section>
  );
}
