"use client";

import { useState } from "react";
import { Button } from "../../components/ui/button";
import { campo, cn } from "../../components/ui/cn";
import { Icone } from "../../components/ui/icone";
import { ItemAnimado, ListaAnimada } from "../../components/ui/movimento";
import { Rotulo } from "../../components/ui/rotulo";

export type ItemDoRascunho = { chave: string; title: string };

/**
 * O checklist de um compromisso novo, antes de salvar: escrever e Enter acrescenta; cada item sobe, desce ou sai.
 * Os itens viram tarefas do compromisso, no primeiro dia, depois que ele é criado.
 */
export function ChecklistDoRascunho({
  itens,
  repete,
  onChange,
}: {
  itens: ItemDoRascunho[];
  repete: boolean;
  onChange: (itens: ItemDoRascunho[]) => void;
}) {
  const [texto, setTexto] = useState("");

  function acrescentar() {
    const title = texto.trim();
    if (!title) return;
    onChange([...itens, { chave: crypto.randomUUID(), title }]);
    setTexto("");
  }

  function trocar(indice: number, delta: number) {
    const destino = indice + delta;
    if (destino < 0 || destino >= itens.length) return;
    const lista = [...itens];
    const [item] = lista.splice(indice, 1);
    if (item) lista.splice(destino, 0, item);
    onChange(lista);
  }

  return (
    <section aria-labelledby="checklist-titulo" className="grid gap-2">
      <Rotulo htmlFor="checklist-novo" dica="O que você precisa levar ou fazer neste compromisso. Os itens aparecem embaixo dele na aba Hoje.">
        <span id="checklist-titulo">
          Checklist <span className="font-normal text-ink-2">(opcional)</span>
        </span>
      </Rotulo>
      <div className="flex min-w-0 gap-2">
        <input
          id="checklist-novo"
          maxLength={160}
          placeholder="Ex.: Levar os documentos"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          onKeyDown={(event) => {
            // Enter acrescenta o item; não envia o formulário do compromisso.
            if (event.key === "Enter") {
              event.preventDefault();
              acrescentar();
            }
          }}
          className={cn(campo, "w-full flex-1")}
        />
        <Button type="button" variant="default" className="px-3 tab:px-4" disabled={!texto.trim()} onClick={acrescentar}>
          <Icone name="add" />
          <span className="sr-only tab:not-sr-only">Acrescentar</span>
        </Button>
      </div>
      {itens.length > 0 ? (
        <ListaAnimada className="grid min-w-0 border border-l-4 border-line border-l-event bg-surface" aria-label="Itens do checklist">
          {itens.map((item, indice) => (
            <ItemAnimado key={item.chave} className="flex min-w-0 items-center gap-2 border-b border-line py-1 pr-1 pl-3 last:border-b-0">
              <span className="size-4 shrink-0 border border-line" aria-hidden />
              <span className="min-w-0 flex-1 break-words text-sm">{item.title}</span>
              <span className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="quiet"
                  className="size-10 px-0"
                  aria-label={`Subir: ${item.title}`}
                  disabled={indice === 0}
                  onClick={() => trocar(indice, -1)}
                >
                  <span className="rotate-90">
                    <Icone name="chevron" />
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  className="size-10 px-0"
                  aria-label={`Descer: ${item.title}`}
                  disabled={indice === itens.length - 1}
                  onClick={() => trocar(indice, 1)}
                >
                  <span className="-rotate-90">
                    <Icone name="chevron" />
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  className="size-10 px-0"
                  aria-label={`Tirar do checklist: ${item.title}`}
                  onClick={() => onChange(itens.filter((outro) => outro.chave !== item.chave))}
                >
                  <Icone name="fechar" />
                </Button>
              </span>
            </ItemAnimado>
          ))}
        </ListaAnimada>
      ) : null}
      <p className="text-xs text-ink-2">
        {repete
          ? "Este compromisso repete: o checklist vale para o primeiro dia. Nos outros dias, a aba Hoje traz o da última vez."
          : "Os itens entram no dia do compromisso, na aba Hoje."}
      </p>
    </section>
  );
}
