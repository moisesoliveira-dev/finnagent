import claro from "../assets/marca-simbolo.png";
import escuro from "../assets/marca-simbolo-escuro.png";
import { useTemaEscuro } from "../tema/tema";

/** O P da marca. No tema escuro vem a versão de P claro e verde suave: o azul-marinho some sobre o fundo escuro. */
export function Simbolo({ altura, decorativo = false }: { altura: number; decorativo?: boolean }) {
  const noEscuro = useTemaEscuro();
  return <img src={noEscuro ? escuro : claro} alt={decorativo ? "" : "Prumo"} height={altura} style={{ display: "block", width: "auto", height: altura }} />;
}
