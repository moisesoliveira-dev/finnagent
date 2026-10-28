"use client";

import { motion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { Button } from "../../components/ui/button";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { Icone } from "../../components/ui/icone";
import { useCurva } from "../../components/ui/movimento";

// Abas sublinhadas com a contagem ao lado. A barra azul desliza para a escolhida. No celular e no tablet a
// fileira rola; no desktop, onde a coluna da lista é estreita, quebra a linha em vez de mostrar a barra de rolagem.
export function Abas<T extends string>({
  rotulo,
  opcoes,
  valor,
  onEscolher,
}: {
  rotulo: string;
  opcoes: Array<{ id: T | null; nome: string; total?: number }>;
  valor: T | null;
  onEscolher: (id: T | null) => void;
}) {
  const marca = useId();
  const curva = useCurva();
  return (
    <div className="min-w-0 overflow-x-auto desk:overflow-visible">
      <div
        role="group"
        aria-label={rotulo}
        className="flex w-max min-w-full border-b border-line desk:w-auto desk:flex-wrap"
      >
        {opcoes.map((opcao) => {
          const ativa = opcao.id === valor;
          return (
            <button
              key={opcao.id ?? "todas"}
              type="button"
              aria-pressed={ativa}
              onClick={() => onEscolher(opcao.id)}
              className={cn(
                "etiqueta-botao relative flex min-h-10 items-center gap-2 px-2 whitespace-nowrap transition-colors",
                ativa ? "text-brand" : "text-ink-2 hover:text-ink",
                focusRing,
              )}
            >
              {opcao.nome}
              {opcao.total === undefined ? null : (
                <span className="tabular-nums">{opcao.total.toLocaleString("pt-BR")}</span>
              )}
              {ativa ? (
                <motion.span
                  layoutId={marca}
                  className="absolute inset-x-0 bottom-0 border-b-2 border-brand"
                  transition={curva}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Busca que espera a pessoa parar de digitar. Se a URL mudar por fora (Limpar filtros), o campo acompanha.
export function CampoDeBusca({
  valor,
  rotulo,
  dica,
  onBuscar,
}: {
  valor: string;
  rotulo: string;
  dica: string;
  onBuscar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const [visto, setVisto] = useState(valor);
  if (valor !== visto) {
    setVisto(valor);
    setTexto(valor);
  }

  useEffect(() => {
    if (texto.trim() === valor) return;
    const espera = setTimeout(() => onBuscar(texto.trim()), 300);
    return () => clearTimeout(espera);
  }, [texto, valor, onBuscar]);

  return (
    <label className="relative flex min-w-0 flex-1 items-center">
      <span className="sr-only">{rotulo}</span>
      <span className="pointer-events-none absolute left-2 flex text-ink-2">
        <Icone name="search" />
      </span>
      <input
        type="search"
        value={texto}
        placeholder={dica}
        onChange={(event) => setTexto(event.target.value)}
        className={cn(campo, "w-full pl-8")}
      />
    </label>
  );
}

export function BotaoAtualizar({ buscando, onAtualizar }: { buscando: boolean; onAtualizar: () => void }) {
  return (
    <Button aria-label="Atualizar" title="Atualizar" carregando={buscando} className="px-3" onClick={onAtualizar}>
      {buscando ? null : <Icone name="refresh" />}
    </Button>
  );
}
