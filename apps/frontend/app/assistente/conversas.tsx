"use client";

import { motion } from "motion/react";
import type { ConversaResumo } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { cn, focusRing } from "../../components/ui/cn";
import { ItemAnimado, ListaAnimada, useCurva } from "../../components/ui/movimento";

const quando = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function rotuloDoDia(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  if (data.toDateString() === hoje.toDateString()) {
    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return quando.format(data);
}

/** Histórico de conversas, como nos chats de IA: a mais recente em cima, a aberta marcada em azul. */
export function Conversas({
  conversas,
  atual,
  trabalhando,
  onNova,
  onAbrir,
  onApagar,
}: {
  conversas: ConversaResumo[];
  atual: string | null;
  trabalhando: boolean;
  onNova: () => void;
  onAbrir: (id: string) => void;
  onApagar: (conversa: ConversaResumo) => void;
}) {
  const curva = useCurva();
  return (
    <nav aria-label="Conversas" className="grid content-start gap-3">
      <Button onClick={onNova} className="w-full justify-start">
        <span aria-hidden className="text-base leading-none">+</span>
        Nova conversa
      </Button>
      {conversas.length === 0 ? (
        <p className="text-sm text-ink-2">As conversas aparecem aqui.</p>
      ) : (
        <ListaAnimada className="grid gap-1">
          {conversas.map((conversa) => {
            const ativa = conversa.id === atual;
            return (
              <ItemAnimado key={conversa.id} className="group relative flex min-w-0 items-stretch">
                {ativa ? (
                  <motion.span layoutId="conversa-ativa" transition={curva} className="absolute inset-y-1 left-0 w-0.5 bg-brand" />
                ) : null}
                <button
                  type="button"
                  disabled={trabalhando}
                  aria-current={ativa ? "true" : undefined}
                  onClick={() => onAbrir(conversa.id)}
                  className={cn(
                    "grid min-h-10 min-w-0 flex-1 gap-1 px-3 py-2 text-left transition-colors hover:bg-surface-2 disabled:cursor-default",
                    focusRing,
                    ativa && "bg-surface",
                  )}
                >
                  <span className={cn("truncate text-sm", ativa ? "font-semibold text-brand" : "text-ink")}>{conversa.title}</span>
                  <span className="flex items-center gap-2 text-sm text-ink-2">
                    {rotuloDoDia(conversa.updatedAt)}
                    {conversa.emAndamento ? (
                      <span className="etiqueta text-brand">Trabalhando</span>
                    ) : conversa.pendente ? (
                      <span className="etiqueta text-pending">Esperando você</span>
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={trabalhando}
                  aria-label={`Apagar a conversa ${conversa.title}`}
                  onClick={() => onApagar(conversa)}
                  className={cn(
                    "grid w-10 shrink-0 place-items-center text-ink-2 opacity-0 transition-colors group-hover:opacity-100 hover:text-neg focus-visible:opacity-100",
                    focusRing,
                  )}
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </button>
              </ItemAnimado>
            );
          })}
        </ListaAnimada>
      )}
    </nav>
  );
}
