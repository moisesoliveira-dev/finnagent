"use client";

import { LIMITE_MENSAGEM_DO_CHAT } from "@finnagent/contracts";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { cn, focusRing } from "../../components/ui/cn";

/** Caixa de mensagem: cresce com o texto, Enter envia, Shift+Enter quebra a linha. */
export function Compositor({
  valor,
  trabalhando,
  desativado,
  aviso,
  onMudar,
  onEnviar,
  onParar,
}: {
  valor: string;
  trabalhando: boolean;
  desativado: boolean;
  aviso: string;
  onMudar: (valor: string) => void;
  onEnviar: () => void;
  onParar: () => void;
}) {
  const caixa = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return;
    elemento.style.height = "auto";
    elemento.style.height = `${Math.min(elemento.scrollHeight, 240)}px`;
  }, [valor]);

  useEffect(() => {
    if (!trabalhando) caixa.current?.focus();
  }, [trabalhando]);

  const restante = LIMITE_MENSAGEM_DO_CHAT - valor.length;
  const podeEnviar = !trabalhando && !desativado && Boolean(valor.trim()) && restante >= 0;

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (podeEnviar) onEnviar();
      }}
    >
      <div
        className={cn(
          "flex items-end gap-2 border bg-surface p-2 transition-colors",
          trabalhando ? "border-brand" : "border-line focus-within:border-brand",
        )}
      >
        <label htmlFor="mensagem-do-assistente" className="sr-only">
          Mensagem para o assistente
        </label>
        <textarea
          id="mensagem-do-assistente"
          ref={caixa}
          rows={1}
          value={valor}
          disabled={desativado}
          maxLength={LIMITE_MENSAGEM_DO_CHAT + 200}
          placeholder={desativado ? "Configure um provedor de IA para conversar" : "Peça para lançar, agendar, organizar ou analisar…"}
          className={cn("min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base text-ink outline-none", focusRing)}
          onChange={(event) => onMudar(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (podeEnviar) onEnviar();
            }
          }}
        />
        <AnimatePresence mode="wait" initial={false}>
          {trabalhando ? (
            <motion.span key="parar" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <Button onClick={onParar} aria-label="Parar o assistente">
                <span aria-hidden className="size-2 bg-ink" />
                Parar
              </Button>
            </motion.span>
          ) : (
            <motion.span key="enviar" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <Button type="submit" variant="primary" disabled={!podeEnviar}>
                Enviar
              </Button>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <p className="flex flex-wrap justify-between gap-2 text-sm text-ink-2">
        <span>{aviso || "Enter envia. Shift+Enter quebra a linha. Ações que apagam pedem sua confirmação."}</span>
        {restante < 400 ? <span className={cn(restante < 0 && "text-neg")}>{restante} caracteres</span> : null}
      </p>
    </form>
  );
}
