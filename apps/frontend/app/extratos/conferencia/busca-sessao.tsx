"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { campo, cn } from "../../../components/ui/cn";

export type SessaoOpcao = { id: string; rotulo: string };

/** O espaço que a lista deixa da borda da janela, e o mínimo que ela mostra antes de abrir para o outro lado. */
const FOLGA = 8;
const ALTURA_MINIMA = 160;
const ALTURA_MAXIMA = 240;

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
  // Onde a lista mora: o modal em volta do campo, se houver, ou o body. Descoberto ao focar o campo.
  const [destino, setDestino] = useState<HTMLElement | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
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
      const alvo = event.target as Node;
      if (!caixa.current?.contains(alvo) && !lista.current?.contains(alvo)) {
        setAberto(false);
        setRascunho(null);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  // A lista mora no body: dentro da linha, o contexto de empilhamento que o Motion cria em cada uma a deixava
  // por baixo da linha seguinte, e o mouse acertava a linha em vez da opção. Aqui ela fica fixa, colada no campo,
  // e abre para cima quando falta lugar embaixo. A posição é escrita direto no elemento, sem passar por estado.
  useLayoutEffect(() => {
    if (!aberto) return;
    function posicionar() {
      const campoDaBusca = entrada.current;
      const ul = lista.current;
      if (!campoDaBusca || !ul) return;
      const medida = campoDaBusca.getBoundingClientRect();
      // Dentro de um modal, a lista mora no próprio <dialog>, que fica acima de tudo. Se o modal ainda está
      // animando (transform), "fixed" passa a contar a partir dele, e a posição desconta o canto do modal.
      const modal = campoDaBusca.closest("dialog");
      const animando = modal && getComputedStyle(modal).transform !== "none";
      const canto = animando ? modal.getBoundingClientRect() : { left: 0, top: 0 };
      const abaixo = window.innerHeight - medida.bottom - FOLGA;
      const acima = medida.top - FOLGA;
      const paraBaixo = abaixo >= ALTURA_MINIMA || abaixo >= acima;
      ul.style.left = `${medida.left - canto.left}px`;
      ul.style.width = `${medida.width}px`;
      ul.style.maxHeight = `${Math.max(Math.min(ALTURA_MAXIMA, paraBaixo ? abaixo : acima), 96)}px`;
      ul.style.top = paraBaixo ? `${medida.bottom + 4 - canto.top}px` : "auto";
      ul.style.bottom = paraBaixo ? "auto" : `${window.innerHeight - medida.top + 4 + canto.top}px`;
    }
    posicionar();
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [aberto]);

  // A opção marcada pelo teclado acompanha a rolagem da lista.
  useEffect(() => {
    if (aberto) lista.current?.children[indice]?.scrollIntoView({ block: "nearest" });
  }, [aberto, indice]);

  function escolher(id: string) {
    onEscolher(id);
    setRascunho(null);
    setAberto(false);
  }

  return (
    <div ref={caixa} className={cn("relative min-w-0 flex-1", className)}>
      <input
        ref={entrada}
        className={cn(campo, "w-full")}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-label={rotulo}
        placeholder="Pesquisar a sessão"
        value={texto}
        onFocus={(event) => {
          setDestino(event.target.closest("dialog") ?? document.body);
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
          if (event.key === "Escape" && aberto) {
            // Fecha só a lista: sem isso, o Escape fecharia também o modal em volta.
            event.preventDefault();
            fechar();
          }
        }}
      />
      {aberto && destino
        ? createPortal(
            <ul
              ref={lista}
              id={listaId}
              role="listbox"
              aria-label={rotulo}
              className="fixed z-50 overflow-auto rounded-sm border border-line bg-surface"
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
            </ul>,
            destino,
          )
        : null}
    </div>
  );
}
