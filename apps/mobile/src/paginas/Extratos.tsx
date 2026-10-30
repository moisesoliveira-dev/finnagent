import { IonButton, IonButtons, IonIcon, IonLabel, IonSegment, IonSegmentButton } from "@ionic/react";
import { chevronBack } from "ionicons/icons";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Pagina } from "../componentes/Pagina";
import { toque } from "../haptico";
import { Bloco, Cascata, Troca } from "../movimento";
import { Conferencia } from "./extratos/Conferencia";
import { Importacoes } from "./extratos/Importacoes";

type Aba = "importacoes" | "conferencia";

/** Importações e Conferência: o extrato do banco entra por uma e é conferido, linha a linha, pela outra. */
export function Extratos() {
  const { search } = useLocation();
  const [aba, setAba] = useState<Aba>(() => (new URLSearchParams(search).get("aba") === "conferencia" ? "conferencia" : "importacoes"));
  const [direcao, setDirecao] = useState(1);

  function trocar(proxima: Aba) {
    if (proxima === aba) return;
    toque();
    setDirecao(proxima === "conferencia" ? 1 : -1);
    setAba(proxima);
  }

  return (
    <Pagina
      titulo="Extratos"
      etiqueta="Conferir o banco com o sistema"
      semPerfil
      fim={
        <IonButtons>
          <IonButton routerLink="/financas" routerDirection="back" aria-label="Voltar">
            <IonIcon slot="icon-only" icon={chevronBack} />
          </IonButton>
        </IonButtons>
      }
    >
      <Cascata className="pagina">
        <Bloco>
          <IonSegment value={aba} onIonChange={(evento) => trocar((evento.detail.value as Aba) ?? "importacoes")}>
            <IonSegmentButton value="importacoes">
              <IonLabel>Importações</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="conferencia">
              <IonLabel>Conferência</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </Bloco>
        <Bloco>
          <Troca chave={aba} direcao={direcao}>
            {aba === "importacoes" ? <Importacoes /> : <Conferencia />}
          </Troca>
        </Bloco>
      </Cascata>
    </Pagina>
  );
}
