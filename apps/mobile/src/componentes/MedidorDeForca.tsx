import { SENHA_MINIMA, forcaDaSenha } from "@finnagent/contracts";
import { motion } from "motion/react";

// A cor de cada nível: curta, razoável, boa, forte.
const TOM_DA_FORCA = ["var(--line)", "var(--neg)", "var(--pending-line)", "var(--pos)", "var(--pos)"] as const;

/** Quatro faixas que enchem da esquerda para a direita e mudam de cor conforme a senha melhora. */
export function MedidorDeForca({ senha }: { senha: string }) {
  const forca = forcaDaSenha(senha);
  return (
    <div className="secao" style={{ gap: 8 }}>
      <div className="medidor" aria-hidden>
        {[1, 2, 3, 4].map((parte) => (
          <span key={parte}>
            <motion.span
              initial={false}
              animate={{ scaleX: forca.nivel >= parte ? 1 : 0, backgroundColor: TOM_DA_FORCA[forca.nivel] }}
              transition={{ duration: 0.25 }}
              style={{ transformOrigin: "0% 50%" }}
            />
          </span>
        ))}
      </div>
      <span className="fraco" style={{ fontSize: "0.75rem" }} aria-live="polite">
        {forca.rotulo ? `Senha ${forca.rotulo.toLowerCase()}. ` : ""}Use {SENHA_MINIMA} ou mais caracteres.
      </span>
    </div>
  );
}
