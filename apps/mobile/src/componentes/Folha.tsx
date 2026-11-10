import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import type { ReactNode } from "react";

/** Uma folha cheia, com o título e o X: o formulário ou o detalhe que abre por cima da tela. */
export function Folha({ aberta, titulo, aoFechar, children }: { aberta: boolean; titulo: string; aoFechar: () => void; children: ReactNode }) {
  return (
    <IonModal isOpen={aberta} onDidDismiss={aoFechar}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{titulo}</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Fechar" onClick={aoFechar}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="pagina">{children}</div>
      </IonContent>
    </IonModal>
  );
}
