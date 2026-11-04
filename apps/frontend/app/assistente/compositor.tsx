"use client";

import { LIMITE_MENSAGEM_DO_CHAT } from "@finnagent/contracts";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { cn, focusRing } from "../../components/ui/cn";
import { Icone } from "../../components/ui/icone";
import { TIPOS_ACEITOS, tamanhoDoAnexo, type AnexoPendente } from "./anexos";

/** Caixa de mensagem: cresce com o texto, Enter envia, Shift+Enter quebra a linha. */
export function Compositor({
  valor,
  anexos,
  trabalhando,
  desativado,
  aviso,
  onMudar,
  onAnexar,
  onRemoverAnexo,
  onEnviar,
  onParar,
}: {
  valor: string;
  anexos: AnexoPendente[];
  trabalhando: boolean;
  desativado: boolean;
  aviso: string;
  onMudar: (valor: string) => void;
  onAnexar: (arquivos: File[]) => void;
  onRemoverAnexo: (indice: number) => void;
  onEnviar: () => void;
  onParar: () => void;
}) {
  const caixa = useRef<HTMLTextAreaElement>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

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
  // O anexo sozinho basta: o sistema escreve a frase do pedido.
  const podeEnviar = !trabalhando && !desativado && (Boolean(valor.trim()) || anexos.length > 0) && restante >= 0;

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (podeEnviar) onEnviar();
      }}
    >
      {anexos.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Arquivos para enviar">
          {anexos.map((anexo, indice) => (
            <li key={`${anexo.name}-${anexo.size}`}>
              <Chip tone="info" className="inline-flex max-w-full items-center gap-2 normal-case">
                <Icone name="clip" />
                <span className="truncate">{anexo.name}</span>
                <span className="text-ink-2">{tamanhoDoAnexo(anexo.size)}</span>
                <button
                  type="button"
                  aria-label={`Remover o anexo ${anexo.name}`}
                  disabled={trabalhando}
                  className={cn("-my-2 -mr-2 grid size-10 place-items-center text-ink-2 hover:text-ink", focusRing)}
                  onClick={() => onRemoverAnexo(indice)}
                >
                  <Icone name="remove" />
                </button>
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}
      <div
        className={cn(
          "flex items-end gap-2 border bg-surface p-2 transition-colors",
          trabalhando || arrastando ? "border-brand" : "border-line focus-within:border-brand",
        )}
        onDragOver={(event) => {
          if (desativado || trabalhando || !event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(event) => {
          setArrastando(false);
          if (desativado || trabalhando || !event.dataTransfer.files.length) return;
          event.preventDefault();
          onAnexar([...event.dataTransfer.files]);
        }}
      >
        <input
          ref={seletor}
          type="file"
          multiple
          hidden
          accept={TIPOS_ACEITOS}
          onChange={(event) => {
            onAnexar([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="quiet"
          className="size-10 px-0"
          aria-label="Anexar arquivo"
          disabled={desativado || trabalhando}
          onClick={() => seletor.current?.click()}
        >
          <Icone name="clip" />
        </Button>
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
          placeholder={desativado ? "Configure um provedor de IA para conversar" : "Peça para lançar, agendar, organizar ou analisar… ou anexe um extrato"}
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
        <span>{aviso || "Enter envia. Shift+Enter quebra a linha. Nada muda sem você aprovar o plano."}</span>
        {restante < 400 ? <span className={cn(restante < 0 && "text-neg")}>{restante} caracteres</span> : null}
      </p>
    </form>
  );
}
