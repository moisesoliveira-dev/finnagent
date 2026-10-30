import { IonButton, IonIcon } from "@ionic/react";
import { AnimatePresence, motion } from "motion/react";
import { chevronBack, chevronForward } from "ionicons/icons";
import { rotuloDoMes, somarMes, type Mes } from "../api/formato";
import { toque } from "../haptico";
import { toqueDoDedo } from "../movimento";

export function SeletorDeMes({ mes, direcao = 1, aoMudar }: { mes: Mes; direcao?: number; aoMudar: (mes: Mes) => void }) {
  const ir = (passo: number) => {
    toque();
    aoMudar(somarMes(mes, passo));
  };
  return (
    <div className="seletor-de-mes">
      <motion.div whileTap={toqueDoDedo}>
        <IonButton fill="outline" size="small" aria-label="Mês anterior" onClick={() => ir(-1)}>
          <IonIcon slot="icon-only" icon={chevronBack} />
        </IonButton>
      </motion.div>
      {/* O nome do mês desliza para o lado que a pessoa foi. */}
      <span style={{ position: "relative", flex: 1, textAlign: "center", overflow: "hidden", minHeight: 28 }}>
        <AnimatePresence mode="popLayout" initial={false} custom={direcao}>
          <motion.strong
            key={rotuloDoMes(mes)}
            custom={direcao}
            style={{ display: "block" }}
            variants={{
              entra: (d: number) => ({ opacity: 0, x: d * 24 }),
              centro: { opacity: 1, x: 0 },
              sai: (d: number) => ({ opacity: 0, x: d * -24 }),
            }}
            initial="entra"
            animate="centro"
            exit="sai"
          >
            {rotuloDoMes(mes)}
          </motion.strong>
        </AnimatePresence>
      </span>
      <motion.div whileTap={toqueDoDedo}>
        <IonButton fill="outline" size="small" aria-label="Próximo mês" onClick={() => ir(1)}>
          <IonIcon slot="icon-only" icon={chevronForward} />
        </IonButton>
      </motion.div>
    </div>
  );
}
