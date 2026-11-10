import { IonButton, IonToggle } from "@ionic/react";
import type { EscolhaDaLinhaNaSerie, MesDaSerieNoExtrato } from "@finnagent/contracts";
import { useEffect, useState } from "react";
import { MESES, reais } from "../../api/formato";
import { Folha } from "../../componentes/Folha";

const chaveDa = (linha: { statementId: string; line: number }) => `${linha.statementId}:${linha.line}`;

function nomeDoMes(chave: string) {
  const [ano, mes] = chave.split("-").map(Number) as [number, number];
  return `${MESES[mes - 1] ?? chave} de ${ano}`;
}

/** Em cada mês incluído, uma linha paga a série e as outras somam como parte. A mesma regra do web (serie.tsx). */
type EscolhaDoMes = { incluido: boolean; principal: string };

export type PedidoDaSerie = { titulo: string; tipo: string; meses: MesDaSerieNoExtrato[]; origem: string | null };

function inicial(pedido: PedidoDaSerie): Record<string, EscolhaDoMes> {
  return Object.fromEntries(
    pedido.meses.map((mes) => {
      const daOrigem = mes.lines.find((linha) => chaveDa(linha) === pedido.origem);
      const previsto = mes.plannedCents;
      const maisPerto = previsto === null ? mes.lines[0] : [...mes.lines].sort((a, b) => Math.abs(a.cents - previsto) - Math.abs(b.cents - previsto))[0];
      return [mes.month, { incluido: true, principal: chaveDa(daOrigem ?? maisPerto ?? mes.lines[0]!) }];
    }),
  );
}

function escolhaDaSerie(meses: MesDaSerieNoExtrato[], escolhas: Record<string, EscolhaDoMes>): EscolhaDaLinhaNaSerie[] {
  return meses.flatMap((mes) => {
    const escolha = escolhas[mes.month];
    if (!escolha?.incluido) return [];
    return mes.lines.map((linha): EscolhaDaLinhaNaSerie => ({ statementId: linha.statementId, line: linha.line, papel: chaveDa(linha) === escolha.principal ? "serie" : "parte" }));
  });
}

/**
 * A mesma compra em vários meses importados, para lançar de uma vez. Cada mês entra ou não; no mês com mais de uma
 * linha, todas somam e a primeira paga a parcela do mês.
 */
export function FolhaDaSerie({
  pedido,
  ocupado,
  aoConfirmar,
  aoSoEsta,
  aoFechar,
}: {
  pedido: PedidoDaSerie | null;
  ocupado: boolean;
  aoConfirmar: (escolha: EscolhaDaLinhaNaSerie[]) => void;
  aoSoEsta?: () => void;
  aoFechar: () => void;
}) {
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaDoMes>>({});

  useEffect(() => {
    if (pedido) setEscolhas(inicial(pedido));
  }, [pedido]);

  const escolha = pedido ? escolhaDaSerie(pedido.meses, escolhas) : [];
  const escolhidas = new Set(escolha.map(chaveDa));
  const total = (pedido?.meses ?? []).flatMap((mes) => mes.lines).filter((linha) => escolhidas.has(chaveDa(linha))).reduce((soma, linha) => soma + linha.cents, 0);

  return (
    <Folha aberta={pedido !== null} titulo={pedido?.titulo ?? ""} aoFechar={aoFechar}>
      {pedido ? (
        <>
          <p className="fraco">
            {pedido.tipo}: escolha os meses que são a mesma compra. Em cada mês vale o valor do extrato.
          </p>
          {pedido.meses.map((mes) => {
            const atual = escolhas[mes.month];
            const daOrigem = mes.lines.some((linha) => chaveDa(linha) === pedido.origem);
            return (
              <div key={mes.month} className="cartao secao">
                <IonToggle
                  checked={Boolean(atual?.incluido)}
                  disabled={daOrigem}
                  onIonChange={(evento) => setEscolhas((anterior) => ({ ...anterior, [mes.month]: { ...anterior[mes.month]!, incluido: evento.detail.checked } }))}
                  labelPlacement="start"
                  justify="space-between"
                >
                  <strong>
                    {nomeDoMes(mes.month)}
                    {mes.numero ? ` · parcela ${mes.numero}` : ""}
                    {mes.antes ? " · antes da série" : ""}
                  </strong>
                </IonToggle>
                <div className="lista">
                  {mes.lines.map((linha) => (
                    <div key={chaveDa(linha)} className="linha">
                      <span className="texto">
                        <span>{linha.description}</span>
                        <span className="etiqueta">
                          {linha.date.slice(8, 10)}/{linha.date.slice(5, 7)}
                          {mes.lines.length > 1 && atual?.principal === chaveDa(linha) ? " · paga a parcela" : ""}
                        </span>
                      </span>
                      <span className={linha.cents < 0 ? "neg" : "pos"}>{reais(linha.cents)}</span>
                    </div>
                  ))}
                </div>
                {mes.plannedCents !== null ? <span className="etiqueta">Previsto: {reais(mes.plannedCents)}</span> : null}
              </div>
            );
          })}
          <p className="fraco">
            {escolha.length} {escolha.length === 1 ? "linha" : "linhas"} · {reais(total)}
          </p>
          <IonButton expand="block" className="principal" disabled={ocupado || escolha.length === 0} onClick={() => aoConfirmar(escolha)}>
            Lançar juntas
          </IonButton>
          {aoSoEsta ? (
            <IonButton expand="block" fill="clear" disabled={ocupado} onClick={aoSoEsta}>
              Lançar só esta linha
            </IonButton>
          ) : null}
        </>
      ) : null}
    </Folha>
  );
}
