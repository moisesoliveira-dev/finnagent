import { IonButton, IonButtons, IonContent, IonDatetime, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import { timeOutline } from "ionicons/icons";
import { useState } from "react";
import { toque } from "../haptico";

/** Um horário ("HH:MM"). Abre a folha do Ionic com a roda de horas e minutos, no lugar do seletor nativo. */
export function Hora({
  rotulo,
  valor,
  aoMudar,
  desabilitado,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  desabilitado?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [rascunho, setRascunho] = useState(valor);

  return (
    <>
      <button
        type="button"
        className="entrada-com-icone selecao hora"
        disabled={desabilitado}
        aria-haspopup="dialog"
        aria-label={`${rotulo}: ${valor}`}
        onClick={() => {
          setRascunho(valor);
          setAberta(true);
        }}
      >
        <IonIcon icon={timeOutline} aria-hidden />
        <span className="valor-escolhido">{valor}</span>
      </button>

      <IonModal isOpen={aberta} className="folha-de-selecao" initialBreakpoint={0.6} breakpoints={[0, 0.6]} onDidDismiss={() => setAberta(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{rotulo}</IonTitle>
            <IonButtons slot="end">
              <IonButton
                onClick={() => {
                  toque();
                  setAberta(false);
                  if (rascunho !== valor) aoMudar(rascunho);
                }}
              >
                Pronto
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="roda-de-hora">
            <IonDatetime
              presentation="time"
              hourCycle="h23"
              value={`2000-01-01T${rascunho}:00`}
              onIonChange={(evento) => {
                const hora = String(evento.detail.value ?? "").slice(11, 16);
                if (/^\d\d:\d\d$/.test(hora)) setRascunho(hora);
              }}
            />
          </div>
        </IonContent>
      </IonModal>
    </>
  );
}
