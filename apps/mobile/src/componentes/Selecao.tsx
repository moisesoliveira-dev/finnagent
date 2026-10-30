import { IonIcon } from "@ionic/react";
import { chevronDown } from "ionicons/icons";
import { motion } from "motion/react";
import { toque } from "../haptico";
import { toqueDoDedo } from "../movimento";

/** Uma lista de escolha com o seletor nativo do sistema (no celular abre a roda ou a folha do próprio Android e iOS). */
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
  return (
    <label className="campo">
      <span className="etiqueta">{rotulo}</span>
      <span className="entrada-com-icone selecao">
        <select value={valor} disabled={desabilitado} onChange={(evento) => aoMudar(evento.target.value)}>
          {vazio !== undefined ? <option value="">{vazio}</option> : null}
          {opcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.texto}
            </option>
          ))}
        </select>
        <IonIcon icon={chevronDown} aria-hidden />
      </span>
    </label>
  );
}

/** Fichas para escolher um filtro: rolam para o lado quando não cabem, e a escolhida fica azul. */
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
