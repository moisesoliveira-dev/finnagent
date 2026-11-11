import { IonButton, IonButtons, IonContent, IonDatetime, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import { calendarOutline } from "ionicons/icons";
import { useState } from "react";
import { toque } from "../haptico";

/** "2026-11-30" como "30/11/2026". */
const noFormatoBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : "");

/**
 * Uma data ("AAAA-MM-DD"). Abre a folha do Ionic com o calendário, no lugar do seletor nativo, no mesmo molde da
 * `Hora`. `limpavel` deixa a pessoa esvaziar a data, para o campo que aceita ficar sem ela.
 */
export function Data({
  rotulo,
  valor,
  aoMudar,
  limpavel = false,
  desabilitado,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  limpavel?: boolean;
  desabilitado?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [rascunho, setRascunho] = useState(valor);

  return (
    <div className="campo">
      <span className="etiqueta">{rotulo}</span>
      <button
        type="button"
        className="entrada-com-icone selecao hora"
        disabled={desabilitado}
        aria-haspopup="dialog"
        aria-label={`${rotulo}: ${noFormatoBr(valor) || "sem data"}`}
        onClick={() => {
          setRascunho(valor);
          setAberta(true);
        }}
      >
        <IonIcon icon={calendarOutline} aria-hidden />
        <span className="valor-escolhido">{noFormatoBr(valor) || "Escolher o dia"}</span>
      </button>

      <IonModal isOpen={aberta} className="folha-de-selecao" initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]} onDidDismiss={() => setAberta(false)}>
        <IonHeader>
          <IonToolbar>
            {limpavel && valor ? (
              <IonButtons slot="start">
                <IonButton
                  onClick={() => {
                    toque();
                    setAberta(false);
                    aoMudar("");
                  }}
                >
                  Limpar
                </IonButton>
              </IonButtons>
            ) : null}
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
              presentation="date"
              locale="pt-BR"
              value={rascunho || undefined}
              onIonChange={(evento) => {
                const dia = String(evento.detail.value ?? "").slice(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(dia)) setRascunho(dia);
              }}
            />
          </div>
        </IonContent>
      </IonModal>
    </div>
  );
}
