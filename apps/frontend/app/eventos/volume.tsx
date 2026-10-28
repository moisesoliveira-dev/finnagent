"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { VolumeDeEventosNoDia } from "@finnagent/contracts";
import { cn, focusRing } from "../../components/ui/cn";
import { useCurva } from "../../components/ui/movimento";
import { diaCurto, diaPorExtenso, quantos } from "./formato";
import { ORDEM_DOS_STATUS, Ponto, STATUS_NO_PLURAL } from "./status";

// No celular cabem 14 colunas que o dedo acerta; com 30, cada uma ficaria fina demais.
const DIAS_NO_CELULAR = 14;

// Uma série só, em azul. A divisão por status fica na leitura abaixo, com o nome de cada um ao lado do ponto:
// pendente e falha juntos na mesma barra se confundem só pela cor.
export function VolumeDeEventos({
  volume,
  dia,
  onEscolher,
}: {
  volume: VolumeDeEventosNoDia[];
  dia: string | null;
  onEscolher: (dia: string) => void;
}) {
  const curva = useCurva();
  const reduzir = useReducedMotion();
  const [foco, setFoco] = useState<string | null>(null);
  if (volume.length === 0) return null;

  const maior = Math.max(1, ...volume.map((item) => item.total));
  const lido = volume.find((item) => item.date === (foco ?? dia));
  const primeiroNoCelular = Math.max(0, volume.length - DIAS_NO_CELULAR);
  const soma = (desde: number) => volume.slice(desde).reduce((total, item) => total + item.total, 0);

  return (
    <figure className="grid min-w-0 gap-2">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="etiqueta text-ink-2">Volume por dia</span>
        <span className="etiqueta text-ink-2">
          <span className="tab:hidden">{DIAS_NO_CELULAR} dias</span>
          <span className="hidden tab:inline">{volume.length} dias</span>
        </span>
      </figcaption>
      <div
        role="group"
        aria-label="Eventos por dia. Escolha um dia para ver só ele."
        className="grid aspect-4/1 min-w-0 auto-cols-fr grid-flow-col gap-1 border-b border-line"
      >
        {volume.map((item, indice) => {
          const altura = item.total === 0 ? 0 : Math.max(4, Math.round((item.total / maior) * 100));
          const escolhido = dia === item.date;
          return (
            <button
              key={item.date}
              type="button"
              aria-pressed={escolhido}
              aria-label={`${diaPorExtenso(item.date)}: ${quantos(item.total, "evento", "eventos")}`}
              onClick={() => onEscolher(item.date)}
              onMouseEnter={() => setFoco(item.date)}
              onMouseLeave={() => setFoco(null)}
              onFocus={() => setFoco(item.date)}
              onBlur={() => setFoco(null)}
              className={cn(
                "min-w-0 items-end transition-colors hover:bg-brand-soft",
                indice < primeiroNoCelular ? "hidden tab:flex" : "flex",
                escolhido && "bg-brand-soft",
                focusRing,
              )}
            >
              {altura ? (
                <motion.span
                  className="w-full origin-bottom bg-brand"
                  style={{ height: `${altura}%` }}
                  initial={{ scaleY: 0, opacity: 1 }}
                  animate={{ scaleY: 1, opacity: dia && !escolhido ? 0.35 : 1 }}
                  transition={{ ...curva, delay: reduzir ? 0 : indice * 0.012 }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div aria-hidden="true" className="etiqueta flex justify-between gap-3 text-ink-2">
        <span className="tab:hidden">{diaCurto(volume[primeiroNoCelular].date)}</span>
        <span className="hidden tab:inline">{diaCurto(volume[0].date)}</span>
        <span>Hoje</span>
      </div>
      <p aria-live="polite" className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {lido ? (
          <>
            <span className="font-medium first-letter:uppercase">{diaPorExtenso(lido.date)}</span>
            <span className="tabular-nums">{quantos(lido.total, "evento", "eventos")}</span>
            {ORDEM_DOS_STATUS.filter((status) => lido.status[status] > 0).map((status) => (
              <span key={status} className="inline-flex items-center gap-2 text-ink-2 tabular-nums">
                <Ponto status={status} />
                {quantos(lido.status[status], status, STATUS_NO_PLURAL[status].toLowerCase())}
              </span>
            ))}
          </>
        ) : (
          <span className="text-ink-2">
            <span className="tab:hidden">{quantos(soma(primeiroNoCelular), "evento", "eventos")}</span>
            <span className="hidden tab:inline">{quantos(soma(0), "evento", "eventos")}</span> no período. Escolha
            um dia para ver só ele.
          </span>
        )}
      </p>
    </figure>
  );
}
