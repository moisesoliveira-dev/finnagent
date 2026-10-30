import { IonIcon, IonInput, IonTextarea } from "@ionic/react";
import { eyeOffOutline, eyeOutline, lockClosedOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { useState, type Ref } from "react";
import { toque } from "../haptico";
import { toqueDoDedo } from "../movimento";

type Base = {
  rotulo: string;
  value: string;
  onMudar: (valor: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "search" | "tel" | "url" | "number";
  inputMode?: "text" | "email" | "search" | "tel" | "url" | "numeric" | "decimal";
  autoComplete?: string;
  autoCapitalize?: string;
  enterKeyHint?: "next" | "go" | "done" | "search" | "send";
  maxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
  /** Enter no teclado: por exemplo, passa para o campo seguinte. */
  aoEnter?: () => void;
  campoRef?: Ref<HTMLIonInputElement>;
};

/** O `IonInput` com a aparência do app: a caixa e a borda ficam por conta do `.entrada-com-icone`. */
function Entrada({ rotulo, onMudar, aoEnter, campoRef, inputMode, autoComplete, autoCapitalize, enterKeyHint, maxLength, ...resto }: Base) {
  return (
    <IonInput
      ref={campoRef}
      {...resto}
      aria-label={rotulo}
      inputmode={inputMode}
      autocomplete={autoComplete as never}
      autocapitalize={autoCapitalize}
      enterkeyhint={enterKeyHint}
      maxlength={maxLength}
      onIonInput={(evento) => onMudar(String(evento.detail.value ?? ""))}
      onKeyDown={(evento) => {
        if (aoEnter && evento.key === "Enter") {
          evento.preventDefault();
          aoEnter();
        }
      }}
    />
  );
}

/** Um campo de texto com o ícone à esquerda: a borda e o ícone ficam azuis no foco. */
export function Campo({ icone, ...base }: Base & { icone: string }) {
  return (
    <div className="campo">
      <span className="etiqueta">{base.rotulo}</span>
      <span className="entrada-com-icone">
        <IonIcon icon={icone} aria-hidden />
        <Entrada {...base} />
      </span>
    </div>
  );
}

/** Um campo de senha com o olho para mostrar ou esconder. */
export function CampoDeSenha({ type: _tipo, maxLength: _max, ...base }: Base) {
  const [vendo, setVendo] = useState(false);
  return (
    <div className="campo">
      <span className="etiqueta">{base.rotulo}</span>
      <span className="entrada-com-icone">
        <IonIcon icon={lockClosedOutline} aria-hidden />
        <Entrada {...base} type={vendo ? "text" : ("password" as never)} maxLength={128} />
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
    </div>
  );
}

/** Um texto de várias linhas, com o contador de caracteres. */
export function AreaDeTexto({
  rotulo,
  value,
  onMudar,
  linhas = 4,
  maxLength,
  disabled,
}: {
  rotulo: string;
  value: string;
  onMudar: (valor: string) => void;
  linhas?: number;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <div className="campo">
      <span className="etiqueta">{rotulo}</span>
      <IonTextarea
        className="area-de-texto"
        aria-label={rotulo}
        rows={linhas}
        maxlength={maxLength}
        value={value}
        disabled={disabled}
        onIonInput={(evento) => onMudar(String(evento.detail.value ?? ""))}
      />
      {maxLength ? (
        <span className="etiqueta" style={{ justifySelf: "end" }}>
          {value.length}/{maxLength}
        </span>
      ) : null}
    </div>
  );
}
