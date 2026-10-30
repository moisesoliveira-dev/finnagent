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
import { notificationsOutline, personCircleOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { toque } from "../haptico";
import { Simbolo } from "./Simbolo";
import { curvaCheia, mola, toqueDoDedo } from "../movimento";
import { useNaoLidas } from "../notificacoes/contagem";

/** O sino: leva para as notificações e mostra quantas faltam ler. */
function Sino() {
  const naoLidas = useNaoLidas();
  return (
    <motion.span style={{ display: "inline-flex" }} whileTap={toqueDoDedo}>
      <IonButton
        routerLink="/notificacoes"
        aria-label={naoLidas === 0 ? "Notificações" : `Notificações, ${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}`}
        className="botao-do-sino"
      >
        <motion.span
          key={naoLidas}
          style={{ display: "inline-flex" }}
          initial={naoLidas > 0 ? { rotate: -14 } : false}
          animate={{ rotate: [-14, 12, -8, 0] }}
          transition={{ duration: 0.5 }}
        >
          <IonIcon slot="icon-only" icon={notificationsOutline} />
        </motion.span>
        <AnimatePresence>
          {naoLidas > 0 ? (
            <motion.span key="contador" aria-hidden className="contador-do-sino" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={mola}>
              {naoLidas > 99 ? "99+" : naoLidas}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </IonButton>
    </motion.span>
  );
}

/**
 * A casca de toda tela: a marca no topo, o sino, o atalho do perfil e puxar para atualizar. O título grande fica no
 * conteúdo (cada tela decide), porque o título que encolhe só existe no modo iOS e o app usa o mesmo visual nos dois.
 */
export function Pagina({
  titulo,
  etiqueta,
  children,
  aoAtualizar,
  fim,
  semPerfil,
  semSino,
  rodape,
}: {
  titulo: string;
  etiqueta?: string;
  children: ReactNode;
  aoAtualizar?: () => Promise<void> | void;
  fim?: ReactNode;
  semPerfil?: boolean;
  semSino?: boolean;
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
            {semSino ? null : <Sino />}
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
