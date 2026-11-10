import { Preenchimento } from "../movimento";

/**
 * Uma barra fina de uso, como a do web (components/ui/barra-de-uso.tsx): azul no normal, âmbar a partir de 80% e
 * vermelha a partir de 100%. Serve ao limite do cartão e ao progresso da meta.
 */
export function BarraDeUso({ percent, rotulo, alerta = true }: { percent: number; rotulo: string; alerta?: boolean }) {
  const tom = !alerta ? "" : percent >= 100 ? "perigo" : percent >= 80 ? "atencao" : "";
  const largura = Math.max(0, Math.min(percent, 100));
  return (
    <div className="barra fina" role="progressbar" aria-label={rotulo} aria-valuenow={Math.round(largura)} aria-valuemin={0} aria-valuemax={100}>
      <Preenchimento porcento={largura} className={tom || undefined} />
    </div>
  );
}
