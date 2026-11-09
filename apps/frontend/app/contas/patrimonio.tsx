"use client";

import { useState } from "react";
import { NOME_MES, evolucaoDoPatrimonio, patrimonio, type Caixinha, type Conta, type Lancamento } from "@finnagent/contracts";
import { Barras } from "../../components/ui/barras";
import { Money } from "../../components/ui/money";
import { Stat } from "../../components/ui/stat";

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
  const temCaixinha = caixinhas.length > 0;
  const temCartao = contas.some((conta) => conta.kind === "cartao");

  return (
    <section className="grid min-w-0 gap-4 border border-line bg-surface p-4" aria-label="Patrimônio">
      <dl className="flex flex-wrap gap-x-8 gap-y-4">
        <Stat label="Patrimônio hoje">
          <Money cents={atual.totalCents} strong />
        </Stat>
        <Stat label="Nas contas">
          <Money cents={atual.contasCents} />
        </Stat>
        {temCaixinha ? (
          <Stat label="Nas caixinhas">
            <Money cents={atual.caixinhasCents} />
          </Stat>
        ) : null}
        {temCartao ? (
          <Stat label="Nos cartões">
            <Money cents={-atual.cartoesCents} />
          </Stat>
        ) : null}
      </dl>
      <div className="grid min-w-0 gap-2">
        <h3 className="etiqueta text-ink-2">Últimos seis meses</h3>
        <Barras barras={barras} ativo={ativo} onEscolher={setAtivo} ariaLabel="Patrimônio no fim de cada mês" />
      </div>
    </section>
  );
}
