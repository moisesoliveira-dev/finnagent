"use client";

import { useEffect, useId, useRef, useState } from "react";
import { campo, cn } from "../../../components/ui/cn";

export type SessaoOpcao = { id: string; rotulo: string };

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

export function BuscaSessao({
  sessoes,
  valor,
  onEscolher,
  rotulo,
  className,
}: {
  sessoes: SessaoOpcao[];
  valor: string;
  onEscolher: (id: string) => void;
  rotulo: string;
  className?: string;
}) {
  const escolhida = sessoes.find((sessao) => sessao.id === valor);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const listaId = useId();
  const texto = rascunho ?? escolhida?.rotulo ?? "";
  const termo = normalizar(texto.trim());
  const pesquisando = termo !== "" && termo !== normalizar(escolhida?.rotulo ?? "");
  const encontradas = sessoes.filter((sessao) => !pesquisando || normalizar(sessao.rotulo).includes(termo));

  function fechar() {
    setAberto(false);
    setRascunho(null);
  }

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(event: MouseEvent) {
      if (!caixa.current?.contains(event.target as Node)) {
        setAberto(false);
        setRascunho(null);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  function escolher(id: string) {
    onEscolher(id);
    setRascunho(null);
    setAberto(false);
  }

  return (
    <div ref={caixa} className={cn("relative min-w-0 flex-1", aberto && "z-20", className)}>
      <input
        className={cn(campo, "w-full")}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-label={rotulo}
        placeholder="Pesquisar a sessão"
        value={texto}
        onFocus={(event) => {
          setAberto(true);
          setIndice(0);
          setRascunho(escolhida?.rotulo ?? "");
          event.target.select();
        }}
        onChange={(event) => {
          const proximo = event.target.value;
          setRascunho(proximo);
          setAberto(true);
          setIndice(0);
          if (escolhida && proximo.trim() !== escolhida.rotulo) onEscolher("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setAberto(true);
            setIndice((atual) => Math.min(atual + 1, Math.max(encontradas.length - 1, 0)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setIndice((atual) => Math.max(atual - 1, 0));
          }
          if (event.key === "Enter" && aberto && encontradas[indice]) {
            event.preventDefault();
            escolher(encontradas[indice].id);
          }
          if (event.key === "Escape") fechar();
        }}
      />
      {aberto ? (
        <ul
          id={listaId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-sm border border-line bg-surface"
        >
          {encontradas.length ? (
            encontradas.map((sessao, posicao) => (
              <li key={sessao.id} role="option" aria-selected={sessao.id === valor}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-surface-2",
                    posicao === indice && "bg-brand-soft text-brand",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    escolher(sessao.id);
                  }}
                >
                  {sessao.rotulo}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-ink-2">Nenhuma sessão encontrada.</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
