import { IonButton, IonIcon } from "@ionic/react";
import { categoriaDoTipo, type RelatorioResposta } from "@finnagent/contracts";
import { arrowBack, chevronBack, chevronForward } from "ionicons/icons";
import { useState } from "react";
import { MESES } from "../api/formato";
import { Dinheiro, Estado } from "../componentes/Estado";
import { Pagina } from "../componentes/Pagina";
import { toque } from "../haptico";
import { Bloco, Cascata, Preenchimento, Troca } from "../movimento";
import { useDados } from "../useDados";
import { ROTULO_CATEGORIA } from "./financas/rotulos";

/** Quanto das saídas do ano foi para este grupo ou categoria, de 0 a 100. */
function parte(saidas: number, total: number) {
  if (saidas >= 0 || total >= 0) return 0;
  return Math.round((saidas / total) * 100);
}

/** O ano inteiro: entradas, saídas e sobra por mês, por grupo e por categoria. Os mesmos números do web. */
export function Relatorios() {
  const [ano, setAno] = useState<number | null>(null);
  const [direcao, setDirecao] = useState(1);
  const { dados, erro, carregando, recarregar } = useDados<RelatorioResposta>(ano ? `/api/relatorios?year=${ano}` : "/api/relatorios");

  function irPara(passo: number) {
    if (!dados) return;
    toque();
    setDirecao(passo);
    setAno(dados.year + passo);
  }

  return (
    <Pagina
      titulo="Relatórios"
      etiqueta="Para onde foi o dinheiro"
      aoAtualizar={recarregar}
      semPerfil
      fim={
        <IonButton routerLink="/financas" routerDirection="back" aria-label="Voltar">
          <IonIcon slot="icon-only" icon={arrowBack} />
        </IonButton>
      }
    >
      <div className="pagina">
        {dados ? (
          <div className="seletor-de-mes">
            <IonButton fill="outline" size="small" aria-label="Ano anterior" disabled={carregando || dados.year <= dados.workflow.year} onClick={() => irPara(-1)}>
              <IonIcon slot="icon-only" icon={chevronBack} />
            </IonButton>
            <strong>{dados.year}</strong>
            <IonButton fill="outline" size="small" aria-label="Próximo ano" disabled={carregando} onClick={() => irPara(1)}>
              <IonIcon slot="icon-only" icon={chevronForward} />
            </IonButton>
          </div>
        ) : null}
        <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />
        {dados ? (
          <Troca chave={String(dados.year)} direcao={direcao}>
            <Cascata className="pagina sem-margem">
              <Bloco className="cartao">
                <span className="etiqueta">Sobra do ano</span>
                <span className="numero grande">
                  <Dinheiro cents={dados.sobra} animado />
                </span>
                <div className="grade separada">
                  <div className="secao" style={{ gap: 4 }}>
                    <span className="etiqueta">Entradas</span>
                    <Dinheiro cents={dados.entradas} forte />
                  </div>
                  <div className="secao" style={{ gap: 4 }}>
                    <span className="etiqueta">Saídas</span>
                    <Dinheiro cents={dados.saidas} forte />
                  </div>
                </div>
              </Bloco>

              <Bloco className="secao">
                <h2 className="etiqueta">Mês a mês</h2>
                <div className="lista">
                  {dados.months.map((item) => (
                    <div key={item.month} className="linha">
                      <span className="texto">
                        <span>{MESES[item.month - 1]}</span>
                        <span className="etiqueta">
                          <Dinheiro cents={item.entradas} /> · <Dinheiro cents={item.saidas} />
                        </span>
                      </span>
                      <Dinheiro cents={item.sobra} />
                    </div>
                  ))}
                </div>
              </Bloco>

              <Bloco className="secao">
                <h2 className="etiqueta">Por grupo</h2>
                <div className="lista">
                  {dados.groups.length === 0 ? <div className="linha fraco">Sem lançamentos no ano.</div> : null}
                  {dados.groups.map((item) => (
                    <div key={item.groupId} className="linha">
                      <div className="texto" style={{ flex: 1 }}>
                        <span>{item.name}</span>
                        <span className="etiqueta">
                          {parte(item.saidas, dados.saidas)}% das saídas · entradas <Dinheiro cents={item.entradas} />
                        </span>
                        <div className="barra">
                          <Preenchimento porcento={parte(item.saidas, dados.saidas)} />
                        </div>
                      </div>
                      <Dinheiro cents={item.saidas} />
                    </div>
                  ))}
                </div>
              </Bloco>

              <Bloco className="secao">
                <h2 className="etiqueta">Por categoria</h2>
                <div className="lista">
                  {dados.types.map((item) => (
                    <div key={item.type} className="linha">
                      <span className="texto">
                        <span>{ROTULO_CATEGORIA[categoriaDoTipo(item.type)]}</span>
                        <span className="etiqueta">
                          entradas <Dinheiro cents={item.entradas} /> · saídas <Dinheiro cents={item.saidas} />
                        </span>
                      </span>
                      <Dinheiro cents={item.sobra} />
                    </div>
                  ))}
                </div>
              </Bloco>
            </Cascata>
          </Troca>
        ) : null}
      </div>
    </Pagina>
  );
}
