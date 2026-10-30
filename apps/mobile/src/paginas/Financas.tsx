import { IonButton, IonIcon, IonLabel, IonSegment, IonSegmentButton, useIonViewWillEnter } from "@ionic/react";
import type { ItemPainel, PainelResposta } from "@finnagent/contracts";
import { documentTextOutline, walletOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { diaDaSemana, reais, rotuloDoMes } from "../api/formato";
import { Dinheiro, Estado, Vazio } from "../componentes/Estado";
import { Pagina } from "../componentes/Pagina";
import { SeletorDeMes } from "../componentes/SeletorDeMes";
import { toque } from "../haptico";
import { Bloco, Cascata, Contagem, Troca } from "../movimento";
import { useDados } from "../useDados";
import { useMes } from "../useMes";

type Filtro = "todos" | "entradas" | "saidas";

function porDia(items: ItemPainel[]) {
  const dias = new Map<number, ItemPainel[]>();
  for (const item of items) dias.set(item.day, [...(dias.get(item.day) ?? []), item]);
  return [...dias.entries()].sort((a, b) => a[0] - b[0]);
}

const passa = (item: ItemPainel, filtro: Filtro) =>
  filtro === "todos" || (item.cents !== null && (filtro === "entradas" ? item.cents > 0 : item.cents < 0));

export function Financas() {
  const { mes, direcao, mudar } = useMes();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const { dados, erro, carregando, recarregar } = useDados<PainelResposta>(`/api/painel?scope=mes&year=${mes.ano}&month=${mes.mes}`);
  const dias = useMemo(() => porDia((dados?.items ?? []).filter((item) => passa(item, filtro))), [dados, filtro]);
  const hoje = new Date();
  const ehEsteMes = hoje.getFullYear() === mes.ano && hoje.getMonth() + 1 === mes.mes;

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });

  return (
    <Pagina
      titulo="Finanças"
      etiqueta="Mês a mês"
      aoAtualizar={recarregar}
      fim={
        <IonButton routerLink="/extratos" aria-label="Extratos: importar e conferir">
          <IonIcon slot="icon-only" icon={documentTextOutline} />
        </IonButton>
      }
    >
      <div className="pagina">
        <SeletorDeMes mes={mes} direcao={direcao} aoMudar={mudar} />

        <Troca chave={rotuloDoMes(mes)} direcao={direcao}>
          <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

          {dados ? (
            <Cascata className="pagina sem-margem">
              <Bloco className="cartao">
                <span className="etiqueta">Sobra</span>
                <span className="numero grande">
                  <Dinheiro cents={dados.sobra} animado />
                </span>
                <div className="grade separada">
                  <div className="secao" style={{ gap: 4 }}>
                    <span className="etiqueta">Entradas</span>
                    <Contagem valor={dados.entradas} formatar={reais} className="numero pos" />
                  </div>
                  <div className="secao" style={{ gap: 4 }}>
                    <span className="etiqueta">Saídas</span>
                    <Contagem valor={dados.saidas} formatar={reais} className="numero neg" />
                  </div>
                </div>
              </Bloco>

              <Bloco>
                <IonSegment
                  value={filtro}
                  onIonChange={(evento) => {
                    toque();
                    setFiltro((evento.detail.value as Filtro) ?? "todos");
                  }}
                >
                  <IonSegmentButton value="todos">
                    <IonLabel>Tudo</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="entradas">
                    <IonLabel>Entradas</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="saidas">
                    <IonLabel>Saídas</IonLabel>
                  </IonSegmentButton>
                </IonSegment>
              </Bloco>

              {dias.length === 0 ? (
                <Bloco>
                  <Vazio
                    icone={walletOutline}
                    titulo={filtro === "todos" ? "Nada neste mês" : "Nada com esse filtro"}
                    texto={filtro === "todos" ? "Peça ao consultor para lançar o que você recebe e o que paga." : "Mude o filtro para ver o resto."}
                  />
                </Bloco>
              ) : null}

              {dias.map(([dia, items]) => {
                const total = items.reduce((soma, item) => soma + (item.cents ?? 0), 0);
                const ehHoje = ehEsteMes && dia === hoje.getDate();
                return (
                  <Bloco key={`${filtro}-${dia}`} className="secao">
                    <div className="titulo-do-dia">
                      <span className="etiqueta" style={ehHoje ? { color: "var(--brand)" } : undefined}>
                        {ehHoje ? "Hoje · " : ""}
                        {diaDaSemana(mes.ano, mes.mes, dia)} {String(dia).padStart(2, "0")}
                      </span>
                      <span className="etiqueta">
                        <Dinheiro cents={total} />
                      </span>
                    </div>
                    <div className="lista">
                      {items.map((item) => (
                        <motion.div
                          key={`${item.kind}-${item.id}`}
                          className={`linha${item.kind === "compromisso" ? " evento" : ""}`}
                          whileTap={{ backgroundColor: "var(--surface-2)" }}
                        >
                          <div className="texto">
                            <span>{item.title}</span>
                            <span className="etiqueta">{item.detail}</span>
                          </div>
                          {item.cents === null ? <span className="etiqueta">Compromisso</span> : <Dinheiro cents={item.cents} />}
                        </motion.div>
                      ))}
                    </div>
                  </Bloco>
                );
              })}
            </Cascata>
          ) : null}
        </Troca>
      </div>
    </Pagina>
  );
}
