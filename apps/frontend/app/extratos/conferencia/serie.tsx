"use client";

import { useState } from "react";
import type { CategoriaTransacao, EscolhaDaLinhaNaSerie, LinhaDaSerie, MesDaSerieNoExtrato } from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { caixaDeMarcar, cn } from "../../../components/ui/cn";
import { Dialogo } from "../../../components/ui/dialogo";
import { Money, formatarReais } from "../../../components/ui/money";
import { Segmentado } from "../../../components/ui/segmentado";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function nomeDoMes(chave: string) {
  const [ano, mes] = chave.split("-").map(Number) as [number, number];
  const nome = MESES[mes - 1] ?? chave;
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

function diaMes(data: string) {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

const chaveDa = (linha: { statementId: string; line: number }) => `${linha.statementId}:${linha.line}`;

/**
 * Como o mês com mais de uma linha entra: todas somadas no mês, só uma delas paga a série, ou (parcela e empréstimo)
 * cada linha paga uma parcela, como quando se paga duas parcelas no mesmo mês.
 */
type ModoDoMes = "somar" | "uma" | "parcelas";

type EscolhaDoMes = { incluido: boolean; modo: ModoDoMes; principal: string };

/**
 * O que mostrar: a série que vai nascer de uma linha (`nova`), com a linha de origem sempre dentro, ou a série que
 * já existe e tem linhas em outros meses (`existente`).
 */
export type PedidoDaSerie = {
  modo: "nova" | "existente";
  titulo: string;
  /** "Parcela", "Empréstimo" ou "Recorrente", e o total de parcelas quando se sabe. */
  tipo: string;
  categoria: CategoriaTransacao;
  total: number | null;
  meses: MesDaSerieNoExtrato[];
  /** A linha de origem, na série nova: o mês dela não sai, e no "só uma" ela vem marcada. */
  origem: string | null;
};

function inicial(pedido: PedidoDaSerie): Record<string, EscolhaDoMes> {
  return Object.fromEntries(
    pedido.meses.map((mes) => {
      const daOrigem = mes.lines.find((linha) => chaveDa(linha) === pedido.origem);
      // Sem a origem, a principal é a que mais se aproxima do valor previsto, ou a primeira do mês.
      const maisPerto = mes.plannedCents === null
        ? mes.lines[0]
        : [...mes.lines].sort((a, b) => Math.abs(a.cents - mes.plannedCents!) - Math.abs(b.cents - mes.plannedCents!))[0];
      // Parcela e empréstimo com linhas de mesmo valor no mês: é mais provável serem duas parcelas do que uma em partes.
      const parcelas = variasPagamNoMes(pedido.categoria) && mes.lines.length > 1 && mes.lines.every((linha) => linha.cents === mes.lines[0]!.cents);
      return [mes.month, { incluido: true, modo: parcelas ? "parcelas" : "somar", principal: chaveDa(daOrigem ?? maisPerto ?? mes.lines[0]!) }];
    }),
  );
}

/** Parcela e empréstimo pagam o que falta, uma parcela por linha; a recorrente tem uma ocorrência por mês. */
function variasPagamNoMes(categoria: CategoriaTransacao) {
  return categoria === "installment" || categoria === "loan";
}

/** A escolha pronta para o backend: em cada mês incluído, uma linha paga a série e as outras somam como parte (ou também pagam). */
export function escolhaDaSerie(meses: MesDaSerieNoExtrato[], escolhas: Record<string, EscolhaDoMes>): EscolhaDaLinhaNaSerie[] {
  return meses.flatMap((mes) => {
    const escolha = escolhas[mes.month];
    if (!escolha?.incluido) return [];
    return mes.lines.flatMap((linha): EscolhaDaLinhaNaSerie[] => {
      if (escolha.modo === "parcelas") return [{ statementId: linha.statementId, line: linha.line, papel: "serie" }];
      const principal = chaveDa(linha) === escolha.principal;
      if (principal) return [{ statementId: linha.statementId, line: linha.line, papel: "serie" }];
      return escolha.modo === "somar" ? [{ statementId: linha.statementId, line: linha.line, papel: "parte" }] : [];
    });
  });
}

function somaDe(linhas: LinhaDaSerie[]) {
  return linhas.reduce((total, linha) => total + linha.cents, 0);
}

/**
 * A mesma compra em vários meses importados, para lançar tudo de uma vez. Cada mês mostra a data e o valor de cada
 * linha. No mês com mais de uma linha, a pessoa escolhe somar todas (uma paga a série e as outras entram como parte,
 * como na sessão Fixo) ou ficar com uma só. Em cada mês vale o valor do extrato.
 */
export function DialogoDaSerie({
  pedido,
  ocupado,
  onConfirmar,
  onSoEsta,
  onFechar,
}: {
  pedido: PedidoDaSerie | null;
  ocupado: boolean;
  onConfirmar: (escolha: EscolhaDaLinhaNaSerie[]) => void;
  /** Na série nova: lança só a linha de origem, sem procurar os outros meses. */
  onSoEsta?: () => void;
  onFechar: () => void;
}) {
  // A escolha volta ao inicial quando chega outro pedido, ajustada durante a renderização.
  const [estado, setEstado] = useState<{ de: PedidoDaSerie | null; escolhas: Record<string, EscolhaDoMes> }>({ de: null, escolhas: {} });
  if (pedido && estado.de !== pedido) setEstado({ de: pedido, escolhas: inicial(pedido) });
  const escolhas = estado.de === pedido ? estado.escolhas : {};
  const setEscolhas = (mudar: (atual: Record<string, EscolhaDoMes>) => Record<string, EscolhaDoMes>) =>
    setEstado((atual) => ({ ...atual, escolhas: mudar(atual.escolhas) }));

  const escolha = pedido ? escolhaDaSerie(pedido.meses, escolhas) : [];
  const meses = pedido?.meses ?? [];
  const incluidos = meses.filter((mes) => escolhas[mes.month]?.incluido);
  const linhasEscolhidas = new Set(escolha.map(chaveDa));
  const total = meses.flatMap((mes) => mes.lines).filter((linha) => linhasEscolhidas.has(chaveDa(linha))).reduce((soma, linha) => soma + linha.cents, 0);
  const mudar = (month: string, parte: Partial<EscolhaDoMes>) =>
    setEscolhas((atual) => ({ ...atual, [month]: { ...atual[month]!, ...parte } }));

  return (
    <Dialogo aberto={pedido !== null} largura="media" aria-labelledby="titulo-serie" onClose={onFechar}>
      {pedido ? (
        <div className="grid min-w-0 gap-4">
          <div className="grid gap-1">
            <span className="etiqueta text-ink-2">{pedido.tipo}{pedido.total ? ` em ${pedido.total} parcelas` : ""}</span>
            <h2 id="titulo-serie" className="font-display text-lg">
              {pedido.titulo}
            </h2>
            <p className="text-sm text-ink-2">
              {pedido.modo === "nova"
                ? "A mesma compra aparece em outros meses importados. Marque os meses que entram: a série começa no mais antigo, cada linha paga a ocorrência do seu mês no valor do extrato, e os meses que ficam pendentes preveem o valor do último mês."
                : "Estas linhas de outros meses importados são a mesma compra. Marque os meses que entram: cada linha paga a ocorrência do seu mês no valor do extrato, e os meses que ficam pendentes preveem o valor do último mês."}
            </p>
          </div>
          <ul className="grid min-w-0 gap-2" aria-label="Meses em que a compra aparece">
            {meses.map((mes) => {
              const atual = escolhas[mes.month];
              if (!atual) return null;
              const daOrigem = mes.lines.some((linha) => chaveDa(linha) === pedido.origem);
              const varias = mes.lines.length > 1;
              const idDoMes = `serie-mes-${mes.month}`;
              return (
                <li key={mes.month} className={cn("grid min-w-0 gap-3 border bg-surface p-3", atual.incluido ? "border-line" : "border-line opacity-60")}>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <label className="flex min-h-10 min-w-0 items-center gap-3">
                      <input
                        id={idDoMes}
                        type="checkbox"
                        className={caixaDeMarcar}
                        checked={atual.incluido}
                        disabled={daOrigem && pedido.modo === "nova"}
                        onChange={(event) => mudar(mes.month, { incluido: event.target.checked })}
                      />
                      <span className="min-w-0 font-medium">{nomeDoMes(mes.month)}</span>
                    </label>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                      {mes.numero !== null ? <span className="etiqueta">Parcela {mes.numero}{pedido.total ? `/${pedido.total}` : ""}</span> : null}
                      {mes.dueDate && mes.plannedCents !== null ? <span>Previsto {formatarReais(mes.plannedCents)} em {diaMes(mes.dueDate)}</span> : null}
                      {daOrigem && pedido.modo === "nova" ? <span className="etiqueta text-brand">Esta linha</span> : null}
                    </span>
                  </div>
                  {varias ? (
                    <div className="grid gap-2">
                      <p className="text-sm text-pending">
                        {mes.lines.length} linhas neste mês, somando {formatarReais(somaDe(mes.lines))}.{" "}
                        {variasPagamNoMes(pedido.categoria)
                          ? "Se são parcelas diferentes (duas no mesmo mês), cada linha paga uma. Se é uma parcela paga em partes, some no mês."
                          : "Some todas no mês ou fique com uma só."}
                      </p>
                      <Segmentado
                        aria-label={`Como ${nomeDoMes(mes.month)} entra`}
                        radio
                        opcoes={[
                          ...(variasPagamNoMes(pedido.categoria) ? [{ id: "parcelas" as const, label: "Cada uma paga uma parcela" }] : []),
                          { id: "somar", label: "Somar no mês" },
                          { id: "uma", label: "Só uma" },
                        ]}
                        valor={atual.modo}
                        onEscolher={(modo) => mudar(mes.month, { modo })}
                      />
                    </div>
                  ) : null}
                  <ul className="grid min-w-0 gap-1">
                    {mes.lines.map((linha) => {
                      const chave = chaveDa(linha);
                      const principal = chave === atual.principal;
                      const fora = varias && atual.modo === "uma" && !principal;
                      return (
                        <li key={chave} className={cn("flex min-w-0 items-center gap-3 text-sm", fora && "text-ink-2")}>
                          {varias && atual.modo === "uma" ? (
                            <label className="flex min-h-10 min-w-0 flex-1 items-center gap-3">
                              <input
                                type="radio"
                                name={`principal-${mes.month}`}
                                className={caixaDeMarcar}
                                checked={principal}
                                disabled={!atual.incluido}
                                onChange={() => mudar(mes.month, { principal: chave })}
                              />
                              <LinhaDoMes linha={linha} />
                            </label>
                          ) : (
                            <span className="flex min-h-10 min-w-0 flex-1 items-center gap-3 pl-1">
                              <LinhaDoMes linha={linha} />
                            </span>
                          )}
                          <span className={cn("shrink-0 text-right", fora && "line-through")}>
                            <Money cents={linha.cents} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {mes.antes ? (
                    <p className="text-sm text-ink-2">
                      {pedido.categoria === "fixed"
                        ? "Antes do início da recorrente: a linha entra como única na mesma sessão, com o nome dela."
                        : "Antes do início: a linha paga a próxima parcela em aberto, e conta neste mês."}
                    </p>
                  ) : null}
                  {mes.plannedCents !== null && atual.incluido && mes.lines.length === 1 && mes.lines[0]!.cents !== mes.plannedCents ? (
                    <p className="text-sm text-ink-2">Neste mês vale o extrato, {formatarReais(mes.lines[0]!.cents)}.</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p role="status" className="text-sm text-ink-2">
            {incluidos.length} {incluidos.length === 1 ? "mês" : "meses"}, {escolha.length} {escolha.length === 1 ? "linha" : "linhas"}, total {formatarReais(total)}.
          </p>
          <div className="dialog-acoes">
            <Button variant="quiet" disabled={ocupado} onClick={onFechar}>
              {pedido.modo === "nova" ? "Cancelar" : "Agora não"}
            </Button>
            {onSoEsta ? (
              <Button disabled={ocupado} onClick={onSoEsta}>
                Só esta linha
              </Button>
            ) : null}
            <Button variant="primary" disabled={ocupado || incluidos.length === 0} onClick={() => onConfirmar(escolha)}>
              {ocupado ? "Lançando…" : "Lançar juntas"}
            </Button>
          </div>
        </div>
      ) : null}
    </Dialogo>
  );
}

function LinhaDoMes({ linha }: { linha: LinhaDaSerie }) {
  return (
    <>
      <time dateTime={linha.date} className="shrink-0 tabular-nums text-ink-2">
        {diaMes(linha.date)}
      </time>
      <span className="min-w-0 truncate">{linha.description}</span>
    </>
  );
}
