import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import type { Extrato, LinhasExtrato } from "@finnagent/contracts";
import { closeOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { diaCompleto } from "../../api/arquivo";
import { Dinheiro, Estado } from "../../componentes/Estado";
import { Fichas } from "../../componentes/Selecao";
import { Bloco, Cascata } from "../../movimento";
import { useDados } from "../../useDados";

type Mostrar = "todas" | "erros";

/** As linhas que a leitura tirou de um extrato, todas ou só as que deram erro. */
export function LinhasDoExtrato({ extrato, soErros, aoFechar }: { extrato: Extrato | null; soErros: boolean; aoFechar: () => void }) {
  const [mostrar, setMostrar] = useState<Mostrar>(soErros ? "erros" : "todas");
  useEffect(() => {
    setMostrar(soErros ? "erros" : "todas");
  }, [extrato, soErros]);

  const caminho = extrato ? `/api/extratos/${extrato.id}/linhas${mostrar === "erros" ? "?erros=1" : ""}` : null;
  const { dados, erro, carregando, recarregar } = useDados<LinhasExtrato>(caminho);

  return (
    <IonModal isOpen={Boolean(extrato)} onDidDismiss={aoFechar}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{extrato?.filename ?? "Linhas"}</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Fechar" onClick={aoFechar}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="pagina">
          <Fichas<Mostrar>
            rotulo="Quais linhas mostrar"
            valor={mostrar}
            aoMudar={setMostrar}
            opcoes={[
              { id: "todas", texto: "Todas" },
              { id: "erros", texto: "Só com erro" },
            ]}
          />
          <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />
          {dados ? (
            <>
              <span className="fraco">
                {dados.total} {dados.total === 1 ? "linha" : "linhas"} no extrato · {dados.matched} já {dados.matched === 1 ? "tem" : "têm"} lançamento
              </span>
              {dados.lines.length === 0 ? <p className="fraco">{mostrar === "erros" ? "Nenhuma linha com erro." : "Nenhuma linha lida."}</p> : null}
              <Cascata className="lista">
                {dados.lines.map((linha) => (
                  <Bloco key={linha.line} className="linha">
                    <span className="dia">{String(linha.line).padStart(2, "0")}</span>
                    <div className="texto" style={{ flex: 1 }}>
                      <span>{linha.description || "Sem descrição"}</span>
                      <span className="etiqueta" style={linha.error ? { color: "var(--neg)" } : undefined}>
                        {linha.error || (linha.date ? diaCompleto(linha.date) : "Sem data")}
                      </span>
                    </div>
                    {linha.cents === null ? null : <Dinheiro cents={linha.cents} />}
                  </Bloco>
                ))}
              </Cascata>
            </>
          ) : null}
        </div>
      </IonContent>
    </IonModal>
  );
}
