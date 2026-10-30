import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
  type RefresherEventDetail,
} from "@ionic/react";
import { personCircleOutline } from "ionicons/icons";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { toque } from "../haptico";
import { Simbolo } from "./Simbolo";
import { curvaCheia, toqueDoDedo } from "../movimento";

/**
 * A casca de toda tela: a marca no topo, o atalho do perfil e puxar para atualizar. O título grande fica no
 * conteúdo (cada tela decide), porque o título que encolhe só existe no modo iOS e o app usa o mesmo visual nos dois.
 */
export function Pagina({
  titulo,
  etiqueta,
  children,
  aoAtualizar,
  fim,
  semPerfil,
  rodape,
}: {
  titulo: string;
  etiqueta?: string;
  children: ReactNode;
  aoAtualizar?: () => Promise<void> | void;
  fim?: ReactNode;
  semPerfil?: boolean;
  rodape?: ReactNode;
}) {
  async function atualizar(evento: CustomEvent<RefresherEventDetail>) {
    toque();
    try {
      await aoAtualizar?.();
    } finally {
      await evento.detail.complete();
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <span slot="start" style={{ display: "inline-flex" }}>
            <Simbolo altura={28} />
          </span>
          <IonButtons slot="end">
            {fim}
            {semPerfil ? null : (
              <motion.span style={{ display: "inline-flex" }} whileTap={toqueDoDedo}>
                <IonButton routerLink="/perfil" aria-label="Perfil">
                  <IonIcon slot="icon-only" icon={personCircleOutline} />
                </IonButton>
              </motion.span>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {aoAtualizar ? (
          <IonRefresher slot="fixed" onIonRefresh={(evento) => void atualizar(evento)}>
            <IonRefresherContent />
          </IonRefresher>
        ) : null}
        <motion.div className="cabecalho-da-tela" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={curvaCheia}>
          {etiqueta ? <span className="etiqueta">{etiqueta}</span> : null}
          <h1 className="titulo">{titulo}</h1>
        </motion.div>
        {children}
      </IonContent>
      {rodape}
    </IonPage>
  );
}
