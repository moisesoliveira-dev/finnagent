import { motion, useMotionValue, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { toque } from "../haptico";

/** Quanto a linha precisa ser levada, em pixels, para a ação valer ao soltar. */
const LIMITE = 96;

export type AcaoDeslizada = {
  /** O que a ação faz, escrito no fundo que aparece: "Concluir", "Apagar". */
  rotulo: string;
  /** Verde para o que dá certo, vermelho para o que apaga. */
  tom: "ok" | "neg";
  aoAcionar: () => void;
};

/**
 * Uma linha que se leva para o lado com o dedo: para a direita (`inicio`) e para a esquerda (`fim`). Passou do
 * limite e soltou, a ação acontece; senão a linha volta. O resto da linha continua rolando a página. É um atalho:
 * a mesma ação existe nos botões da própria tela, para quem não desliza.
 */
export function Deslizar({ inicio, fim, children }: { inicio?: AcaoDeslizada; fim?: AcaoDeslizada; children: ReactNode }) {
  const x = useMotionValue(0);
  // Cada fundo só aparece do lado para onde a linha foi levada: parada, ou entrando na tela, não vaza nada.
  const verInicio = useTransform(x, (valor) => (valor > 1 ? 1 : 0));
  const verFim = useTransform(x, (valor) => (valor < -1 ? 1 : 0));
  const arrastou = useRef(false);
  const passou = useRef(false);

  if (!inicio && !fim) return <>{children}</>;

  return (
    <div className="deslizar">
      {inicio ? (
        <motion.div className={`deslizar-fundo inicio ${inicio.tom}`} style={{ opacity: verInicio }} aria-hidden="true">
          {inicio.rotulo}
        </motion.div>
      ) : null}
      {fim ? (
        <motion.div className={`deslizar-fundo fim ${fim.tom}`} style={{ opacity: verFim }} aria-hidden="true">
          {fim.rotulo}
        </motion.div>
      ) : null}
      <motion.div
        className="deslizar-conteudo"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: fim ? 0.9 : 0, right: inicio ? 0.9 : 0 }}
        dragSnapToOrigin
        onDragStart={() => {
          arrastou.current = true;
          passou.current = false;
        }}
        onDrag={() => {
          // Uma batida leve quando a ação passa a valer, para saber que dá para soltar.
          const agora = Boolean((inicio && x.get() >= LIMITE) || (fim && x.get() <= -LIMITE));
          if (agora && !passou.current) toque();
          passou.current = agora;
        }}
        onDragEnd={() => {
          const deslocamento = x.get();
          if (inicio && deslocamento >= LIMITE) {
            toque(true);
            inicio.aoAcionar();
          } else if (fim && deslocamento <= -LIMITE) {
            toque(true);
            fim.aoAcionar();
          }
          // O toque que fecha o arraste não pode abrir a linha.
          setTimeout(() => {
            arrastou.current = false;
          }, 60);
        }}
        onClickCapture={(evento) => {
          if (!arrastou.current) return;
          evento.stopPropagation();
          evento.preventDefault();
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
