import { IonIcon } from "@ionic/react";
import { reorderThreeOutline } from "ionicons/icons";
import { Reorder, useDragControls } from "motion/react";
import type { ReactNode } from "react";
import { toque } from "../haptico";

/**
 * Uma lista que se reorganiza com o dedo: segure a alça, arraste e solte. Só a alça arrasta, então o resto do item
 * continua rolando a página. Com a lista desligada (na busca), ela é comum e os itens não têm alça.
 */
export function ListaOrdenavel<T>({
  itens,
  aoMudar,
  className,
  children,
}: {
  itens: T[];
  aoMudar: (itens: T[]) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Reorder.Group as="div" axis="y" values={itens} onReorder={aoMudar} className={className}>
      {children}
    </Reorder.Group>
  );
}

/** O item da lista. `children` recebe a alça, para a tela escolher onde ela fica. */
export function ItemOrdenavel<T>({
  valor,
  nome,
  className,
  aoSoltar,
  aoMover,
  children,
}: {
  valor: T;
  nome: string;
  className?: string;
  /** Roda quando o dedo solta o item: é a hora de gravar a ordem. */
  aoSoltar: () => void;
  /** As setas do teclado na alça (leitor de tela e teclado externo). */
  aoMover: (passo: -1 | 1) => void;
  children: (alca: ReactNode) => ReactNode;
}) {
  const controles = useDragControls();
  const alca = (
    <button
      type="button"
      className="alca"
      aria-label={`Reordenar ${nome}. Segure e arraste.`}
      onPointerDown={(evento) => {
        toque();
        controles.start(evento);
      }}
      onKeyDown={(evento) => {
        if (evento.key !== "ArrowUp" && evento.key !== "ArrowDown") return;
        evento.preventDefault();
        aoMover(evento.key === "ArrowUp" ? -1 : 1);
      }}
    >
      <IonIcon icon={reorderThreeOutline} aria-hidden="true" />
    </button>
  );
  return (
    <Reorder.Item
      as="div"
      value={valor}
      dragListener={false}
      dragControls={controles}
      whileDrag={{ scale: 1.02 }}
      onDragStart={() => toque(true)}
      onDragEnd={() => {
        toque();
        aoSoltar();
      }}
      className={className}
    >
      {children(alca)}
    </Reorder.Item>
  );
}
