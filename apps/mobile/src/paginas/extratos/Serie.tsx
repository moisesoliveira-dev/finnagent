import { IonButton, IonToggle } from "@ionic/react";
import type { CategoriaTransacao, EscolhaDaLinhaNaSerie, MesDaSerieNoExtrato } from "@finnagent/contracts";
import { useEffect, useState } from "react";
import { MESES, reais } from "../../api/formato";
import { Folha } from "../../componentes/Folha";
import { Fichas } from "../../componentes/Selecao";

const chaveDa = (linha: { statementId: string; line: number }) => `${linha.statementId}:${linha.line}`;

function nomeDoMes(chave: string) {
  const [ano, mes] = chave.split("-").map(Number) as [number, number];
  return `${MESES[mes - 1] ?? chave} de ${ano}`;
}

/**
 * Como o mês com mais de uma linha entra: cada linha paga uma parcela (duas parcelas no mesmo mês), todas somam
 * numa parte só, ou só uma delas paga. A mesma regra do web (serie.tsx).
 */
type ModoDoMes = "parcelas" | "somar" | "uma";
type EscolhaDoMes = { incluido: boolean; modo: ModoDoMes; principal: string };

export type PedidoDaSerie = { titulo: string; tipo: string; categoria: CategoriaTransacao; meses: MesDaSerieNoExtrato[]; origem: string | null };

/** Parcela e empréstimo pagam o que falta, uma parcela por linha; a recorrente tem uma ocorrência por mês. */
const variasPagamNoMes = (categoria: CategoriaTransacao) => categoria === "installment" || categoria === "loan";

function inicial(pedido: PedidoDaSerie): Record<string, EscolhaDoMes> {
  return Object.fromEntries(
    pedido.meses.map((mes) => {
      const daOrigem = mes.lines.find((linha) => chaveDa(linha) === pedido.origem);
      const previsto = mes.plannedCents;
      const maisPerto = previsto === null ? mes.lines[0] : [...mes.lines].sort((a, b) => Math.abs(a.cents - previsto) - Math.abs(b.cents - previsto))[0];
      // Parcela e empréstimo com linhas de mesmo valor no mês: é mais provável serem duas parcelas do que uma em partes.
      const parcelas = variasPagamNoMes(pedido.categoria) && mes.lines.length > 1 && mes.lines.every((linha) => linha.cents === mes.lines[0]!.cents);
      return [mes.month, { incluido: true, modo: parcelas ? "parcelas" : "somar", principal: chaveDa(daOrigem ?? maisPerto ?? mes.lines[0]!) } satisfies EscolhaDoMes];
    }),
  );
}

function escolhaDaSerie(meses: MesDaSerieNoExtrato[], escolhas: Record<string, EscolhaDoMes>): EscolhaDaLinhaNaSerie[] {
  return meses.flatMap((mes) => {
    const escolha = escolhas[mes.month];
    if (!escolha?.incluido) return [];
    return mes.lines.flatMap((linha): EscolhaDaLinhaNaSerie[] => {
      if (escolha.modo === "parcelas") return [{ statementId: linha.statementId, line: linha.line, papel: "serie" }];
      if (chaveDa(linha) === escolha.principal) return [{ statementId: linha.statementId, line: linha.line, papel: "serie" }];
      return escolha.modo === "somar" ? [{ statementId: linha.statementId, line: linha.line, papel: "parte" }] : [];
    });
  });
}

/**
 * A mesma compra em vários meses importados, para lançar de uma vez. Cada mês entra ou não; no mês com mais de uma
 * linha, a pessoa diz se cada uma paga uma parcela, se somam como uma só ou se fica uma só.
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
                    {mes.numero ? (atual?.modo === "parcelas" && mes.lines.length > 1 ? ` · parcelas ${mes.numero} a ${mes.numero + mes.lines.length - 1}` : ` · parcela ${mes.numero}`) : ""}
                    {mes.antes ? " · antes da série" : ""}
                  </strong>
                </IonToggle>
                {mes.lines.length > 1 && atual ? (
                  <div className="campo">
                    <span className="fraco">
                      {mes.lines.length} linhas neste mês, somando {reais(mes.lines.reduce((soma, linha) => soma + linha.cents, 0))}.{" "}
                      {variasPagamNoMes(pedido.categoria)
                        ? "Se são parcelas diferentes (duas no mesmo mês), cada linha paga uma. Se é uma parcela paga em partes, some no mês."
                        : "Some todas no mês ou fique com uma só."}
                    </span>
                    <Fichas<ModoDoMes>
                      rotulo={`Como ${nomeDoMes(mes.month)} entra`}
                      valor={atual.modo}
                      opcoes={[
                        ...(variasPagamNoMes(pedido.categoria) ? [{ id: "parcelas" as const, texto: "Cada uma paga uma parcela" }] : []),
                        { id: "somar" as const, texto: "Somar no mês" },
                        { id: "uma" as const, texto: "Só uma" },
                      ]}
                      aoMudar={(modo) => setEscolhas((anterior) => ({ ...anterior, [mes.month]: { ...anterior[mes.month]!, modo } }))}
                    />
                  </div>
                ) : null}
                <div className="lista">
                  {mes.lines.map((linha) => {
                    const fora = mes.lines.length > 1 && atual?.modo === "uma" && atual.principal !== chaveDa(linha);
                    return (
                      <button
                        key={chaveDa(linha)}
                        type="button"
                        className="linha linha-botao"
                        disabled={!(mes.lines.length > 1 && atual?.modo === "uma")}
                        onClick={() => setEscolhas((anterior) => ({ ...anterior, [mes.month]: { ...anterior[mes.month]!, principal: chaveDa(linha) } }))}
                        style={fora ? { opacity: 0.5 } : undefined}
                      >
                        <span className="texto">
                          <span>{linha.description}</span>
                          <span className="etiqueta">
                            {linha.date.slice(8, 10)}/{linha.date.slice(5, 7)}
                            {mes.lines.length > 1 && atual?.modo === "uma" && !fora ? " · a que entra" : ""}
                            {mes.lines.length > 1 && atual?.modo === "somar" && atual.principal === chaveDa(linha) ? " · paga a parcela" : ""}
                            {mes.lines.length > 1 && atual?.modo === "parcelas" ? " · paga uma parcela" : ""}
                          </span>
                        </span>
                        <span className={linha.cents < 0 ? "neg" : "pos"} style={fora ? { textDecoration: "line-through" } : undefined}>{reais(linha.cents)}</span>
                      </button>
                    );
                  })}
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
