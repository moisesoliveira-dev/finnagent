import type { MesPainel } from "@finnagent/contracts";
import { motion } from "motion/react";
import { MESES } from "../api/formato";
import { reais } from "../api/formato";

const INICIAIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** A sobra de cada mês do ano: verde acima da linha, vermelho abaixo, o mês atual com contorno. */
export function BarrasDoAno({ meses, atual }: { meses: MesPainel[]; atual: number }) {
  const porMes = new Map(meses.map((item) => [item.month, item.sobra]));
  const maior = Math.max(1, ...meses.map((item) => Math.abs(item.sobra)));
  const metade = 36;
  const resumo = INICIAIS.map((_, indice) => `${MESES[indice]}: ${reais(porMes.get(indice + 1) ?? 0)}`).join("; ");

  return (
    <svg viewBox={`0 0 240 ${metade * 2 + 20}`} role="img" aria-label={`Sobra por mês. ${resumo}`} className="barras">
      <line x1="0" x2="240" y1={metade} y2={metade} stroke="var(--line)" strokeWidth="1" />
      {INICIAIS.map((inicial, indice) => {
        const valor = porMes.get(indice + 1) ?? 0;
        const altura = Math.max(valor === 0 ? 0 : 2, Math.round((Math.abs(valor) / maior) * (metade - 2)));
        const x = indice * 20 + 3;
        const y = valor >= 0 ? metade - altura : metade;
        return (
          <g key={inicial + indice}>
            {/* Cada barra cresce a partir da linha do zero, uma depois da outra. */}
            <motion.rect
              x={x}
              width="14"
              fill={valor >= 0 ? "var(--pos)" : "var(--neg)"}
              opacity={indice + 1 === atual ? 1 : 0.55}
              initial={{ y: metade, height: 0 }}
              animate={{ y, height: altura }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 + indice * 0.04 }}
            />
            {indice + 1 === atual ? (
              <motion.rect
                x={x - 2}
                y="0"
                width="18"
                height={metade * 2}
                fill="none"
                stroke="var(--brand)"
                strokeWidth="1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
              />
            ) : null}
            <text x={x + 7} y={metade * 2 + 14} textAnchor="middle" fontSize="9" fill="var(--ink-2)" fontFamily="var(--fonte-mono)">
              {inicial}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
