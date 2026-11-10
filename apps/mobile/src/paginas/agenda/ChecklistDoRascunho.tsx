import { IonButton, IonIcon } from "@ionic/react";
import { addOutline, arrowDown, arrowUp, checkboxOutline, closeOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Campo } from "../../componentes/Campo";
import { toque } from "../../haptico";
import { curvaCheia, curvaSaida } from "../../movimento";

export type ItemDoRascunho = { chave: string; title: string };

/**
 * O checklist de um compromisso novo, antes de salvar, como no web (app/agenda/checklist-do-rascunho.tsx): escrever e
 * acrescentar; cada item sobe, desce ou sai. Os itens viram tarefas do compromisso, no primeiro dia, depois que ele é criado.
 */
export function ChecklistDoRascunho({ itens, repete, aoMudar }: { itens: ItemDoRascunho[]; repete: boolean; aoMudar: (itens: ItemDoRascunho[]) => void }) {
  const [texto, setTexto] = useState("");

  function acrescentar() {
    const title = texto.trim();
    if (!title) return;
    toque();
    aoMudar([...itens, { chave: crypto.randomUUID(), title }]);
    setTexto("");
  }

  function trocar(indice: number, delta: number) {
    const destino = indice + delta;
    if (destino < 0 || destino >= itens.length) return;
    const lista = [...itens];
    const [item] = lista.splice(indice, 1);
    if (item) lista.splice(destino, 0, item);
    aoMudar(lista);
  }

  return (
    <section className="secao" aria-labelledby="checklist-titulo">
      <h2 id="checklist-titulo" className="etiqueta">
        Checklist (opcional)
      </h2>
      <div className="checklist-novo">
        <Campo icone={checkboxOutline} rotulo="Item do checklist" value={texto} onMudar={setTexto} placeholder="Ex.: Levar os documentos" maxLength={160} enterKeyHint="done" aoEnter={acrescentar} />
        <IonButton fill="outline" aria-label="Acrescentar ao checklist" disabled={!texto.trim()} onClick={acrescentar}>
          <IonIcon slot="icon-only" icon={addOutline} />
        </IonButton>
      </div>
      {itens.length > 0 ? (
        <div className="lista checklist" aria-label="Itens do checklist">
          <AnimatePresence initial={false}>
            {itens.map((item, indice) => (
              <motion.div
                key={item.chave}
                layout
                className="linha"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto", transition: curvaCheia }}
                exit={{ opacity: 0, height: 0, transition: curvaSaida }}
              >
                <span className="caixa-do-item" aria-hidden />
                <span className="texto" style={{ flex: 1 }}>
                  <span>{item.title}</span>
                </span>
                <span className="botoes-do-item">
                  <IonButton fill="clear" size="small" aria-label={`Subir: ${item.title}`} disabled={indice === 0} onClick={() => trocar(indice, -1)}>
                    <IonIcon slot="icon-only" icon={arrowUp} />
                  </IonButton>
                  <IonButton fill="clear" size="small" aria-label={`Descer: ${item.title}`} disabled={indice === itens.length - 1} onClick={() => trocar(indice, 1)}>
                    <IonIcon slot="icon-only" icon={arrowDown} />
                  </IonButton>
                  <IonButton fill="clear" size="small" aria-label={`Tirar do checklist: ${item.title}`} onClick={() => aoMudar(itens.filter((outro) => outro.chave !== item.chave))}>
                    <IonIcon slot="icon-only" icon={closeOutline} />
                  </IonButton>
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : null}
      <p className="fraco">
        {repete
          ? "Este compromisso repete: o checklist vale para o primeiro dia. Nos outros dias, dá para trazer o da última vez na aba Hoje."
          : "Os itens entram no dia do compromisso, na aba Hoje."}
      </p>
    </section>
  );
}
