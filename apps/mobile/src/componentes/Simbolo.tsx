import claro from "../assets/marca-simbolo.png";
import escuro from "../assets/marca-simbolo-escuro.png";

/** O P da marca. No tema escuro vem a versão de P claro e verde suave: o azul-marinho some sobre o fundo escuro. */
export function Simbolo({ altura, decorativo = false }: { altura: number; decorativo?: boolean }) {
  return (
    <picture>
      <source srcSet={escuro} media="(prefers-color-scheme: dark)" />
      <img src={claro} alt={decorativo ? "" : "Prumo"} height={altura} style={{ display: "block", width: "auto", height: altura }} />
    </picture>
  );
}
