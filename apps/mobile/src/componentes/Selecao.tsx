import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import { checkmark, chevronDown, closeOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { useState } from "react";
import { toque } from "../haptico";
import { toqueDoDedo } from "../movimento";

/**
 * Uma lista de escolha. Abre uma folha do Ionic (e não o seletor nativo do sistema, que no tema escuro ignora as
 * cores do app e fica ilegível), com os tokens do app. O texto de cada opção quebra de linha: são descrições longas.
 */
export function Selecao({
  rotulo,
  valor,
  opcoes,
  vazio,
  aoMudar,
  desabilitado,
}: {
  rotulo: string;
  valor: string;
  opcoes: Array<{ id: string; texto: string }>;
  vazio?: string;
  aoMudar: (valor: string) => void;
  desabilitado?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const todas = vazio !== undefined ? [{ id: "", texto: vazio }, ...opcoes] : opcoes;
  const escolhida = todas.find((opcao) => opcao.id === valor);

  function escolher(id: string) {
    toque();
    setAberta(false);
    if (id !== valor) aoMudar(id);
  }

  return (
    <div className="campo">
      <span className="etiqueta">{rotulo}</span>
      <button type="button" className="entrada-com-icone selecao" disabled={desabilitado} aria-haspopup="dialog" aria-label={`${rotulo}: ${escolhida?.texto ?? "nenhum"}`} onClick={() => setAberta(true)}>
        <span className={`valor-escolhido${escolhida && valor !== "" ? "" : " vazio"}`}>{escolhida && valor !== "" ? escolhida.texto : (vazio ?? "Escolha")}</span>
        <IonIcon icon={chevronDown} aria-hidden />
      </button>

      <IonModal isOpen={aberta} className="folha-de-selecao" initialBreakpoint={0.6} breakpoints={[0, 0.6, 1]} onDidDismiss={() => setAberta(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{rotulo}</IonTitle>
            <IonButtons slot="end">
              <IonButton aria-label="Fechar" onClick={() => setAberta(false)}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="opcoes" role="listbox" aria-label={rotulo}>
            {todas.map((opcao) => (
              <motion.button
                key={opcao.id || "vazio"}
                type="button"
                role="option"
                aria-selected={opcao.id === valor}
                className={`opcao${opcao.id === valor ? " ativa" : ""}`}
                whileTap={{ backgroundColor: "var(--surface-2)" }}
                onClick={() => escolher(opcao.id)}
              >
                <span>{opcao.texto}</span>
                {opcao.id === valor ? <IonIcon icon={checkmark} aria-hidden /> : null}
              </motion.button>
            ))}
          </div>
        </IonContent>
      </IonModal>
    </div>
  );
}

export function Fichas<T extends string>({
  valor,
  opcoes,
  aoMudar,
  rotulo,
}: {
  valor: T;
  opcoes: Array<{ id: T; texto: string }>;
  aoMudar: (valor: T) => void;
  rotulo: string;
}) {
  return (
    <div className="fichas" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <motion.button
          key={opcao.id}
          type="button"
          role="radio"
          aria-checked={valor === opcao.id}
          className={`ficha${valor === opcao.id ? " ativa" : ""}`}
          whileTap={toqueDoDedo}
          onClick={() => {
            toque();
            aoMudar(opcao.id);
          }}
        >
          {opcao.texto}
        </motion.button>
      ))}
    </div>
  );
}
