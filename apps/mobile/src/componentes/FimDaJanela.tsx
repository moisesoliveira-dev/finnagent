import { IonButton } from "@ionic/react";
import { useEffect, useRef } from "react";

/**
 * O fim de uma lista que se mostra aos poucos: perto do fim, a lista mostra mais; o botão serve a quem prefere
 * tocar. A lista inteira continua existindo para os totais e para as ações em lote: só o que é desenhado vai por janelas.
 */
export function FimDaJanela({
  mostradas,
  total,
  porVez,
  aoMostrarMais,
  aoMostrarTodas,
  nome = "linhas",
}: {
  mostradas: number;
  total: number;
  porVez: number;
  aoMostrarMais: () => void;
  aoMostrarTodas: () => void;
  nome?: string;
}) {
  const marca = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = marca.current;
    if (!elemento || mostradas >= total) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) aoMostrarMais();
      },
      { rootMargin: "600px 0px" },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [mostradas, total, aoMostrarMais]);

  if (total <= 0) return null;
  const faltam = Math.max(total - mostradas, 0);
  return (
    <div ref={marca} className="secao">
      <span className="fraco" aria-live="polite">
        Mostrando {Math.min(mostradas, total)} de {total} {nome}
      </span>
      {faltam > 0 ? (
        <div className="acoes-da-folha">
          <IonButton size="small" fill="outline" onClick={aoMostrarMais}>
            Mostrar mais {Math.min(porVez, faltam)}
          </IonButton>
          <IonButton size="small" fill="clear" onClick={aoMostrarTodas}>
            Mostrar todas
          </IonButton>
        </div>
      ) : null}
    </div>
  );
}
