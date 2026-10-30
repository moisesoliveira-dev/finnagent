import { IonIcon } from "@ionic/react";
import { eyeOffOutline, eyeOutline, lockClosedOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { useState, type InputHTMLAttributes } from "react";
import { toque } from "../haptico";
import { toqueDoDedo } from "../movimento";

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  rotulo: string;
  onMudar: (valor: string) => void;
};

/** Um campo de texto com o ícone à esquerda: a borda e o ícone ficam azuis no foco. */
export function Campo({ rotulo, icone, onMudar, ...resto }: Base & { icone: string }) {
  return (
    <label className="campo">
      <span className="etiqueta">{rotulo}</span>
      <span className="entrada-com-icone">
        <IonIcon icon={icone} aria-hidden />
        <input {...resto} onChange={(evento) => onMudar(evento.target.value)} />
      </span>
    </label>
  );
}

/** Um campo de senha com o olho para mostrar ou esconder. */
export function CampoDeSenha({ rotulo, onMudar, ...resto }: Base) {
  const [vendo, setVendo] = useState(false);
  return (
    <label className="campo">
      <span className="etiqueta">{rotulo}</span>
      <span className="entrada-com-icone">
        <IonIcon icon={lockClosedOutline} aria-hidden />
        <input {...resto} type={vendo ? "text" : "password"} maxLength={128} onChange={(evento) => onMudar(evento.target.value)} />
        <motion.button
          type="button"
          className="olho"
          aria-label={vendo ? "Esconder a senha" : "Mostrar a senha"}
          whileTap={toqueDoDedo}
          onClick={() => {
            toque();
            setVendo((atual) => !atual);
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={vendo ? "esconder" : "mostrar"}
              style={{ display: "inline-flex" }}
              initial={{ opacity: 0, rotate: -40, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 40, scale: 0.6 }}
              transition={{ duration: 0.14 }}
            >
              <IonIcon icon={vendo ? eyeOffOutline : eyeOutline} />
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </span>
    </label>
  );
}
