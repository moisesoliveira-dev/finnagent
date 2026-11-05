"use client";

import { LIMITE_MENSAGEM_DO_CHAT } from "@finnagent/contracts";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { cn, focusRing } from "../../components/ui/cn";
import { Icone } from "../../components/ui/icone";
import { TIPOS_ACEITOS, tamanhoDoAnexo, type AnexoPendente } from "./anexos";
import { useDitado } from "./ditado";

/**
 * Caixa de mensagem, como nos chats de IA: o "+" à esquerda guarda o que entra junto com a mensagem (anexo), o
 * microfone e o botão de enviar ficam à direita, só com ícone. Enter envia, Shift+Enter quebra a linha.
 */
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
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [arrastando, setArrastando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  // O que já estava escrito quando o ditado começou: a fala entra depois disso.
  const antesDoDitado = useRef("");
  const ditado = useDitado((falado) => onMudar([antesDoDitado.current, falado].filter(Boolean).join(" ")));

  function alternarDitado() {
    if (ditado.ouvindo) {
      ditado.parar();
      return;
    }
    antesDoDitado.current = valor.trim();
    void ditado.iniciar();
  }

  useEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return;
    elemento.style.height = "auto";
    elemento.style.height = `${Math.min(elemento.scrollHeight, 240)}px`;
  }, [valor]);

  useEffect(() => {
    if (!trabalhando) caixa.current?.focus();
  }, [trabalhando]);

  // O menu do "+" fecha ao clicar fora ou com Escape.
  useEffect(() => {
    if (!menuAberto) return;
    function aoClicarFora(event: MouseEvent) {
      if (!menu.current?.contains(event.target as Node)) setMenuAberto(false);
    }
    function aoTeclar(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [menuAberto]);

  const restante = LIMITE_MENSAGEM_DO_CHAT - valor.length;
  // O anexo sozinho basta: o sistema escreve a frase do pedido.
  const podeEnviar = !trabalhando && !desativado && (Boolean(valor.trim()) || anexos.length > 0) && restante >= 0;

  function enviar() {
    if (!podeEnviar) return;
    ditado.parar();
    onEnviar();
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        enviar();
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
          "flex min-w-0 flex-wrap items-end gap-2 border bg-surface p-2 transition-colors",
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
        <div ref={menu} className="relative">
          <Button
            type="button"
            variant="quiet"
            className="size-10 px-0"
            aria-label="Mais opções da mensagem"
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            aria-controls={menuId}
            disabled={desativado || trabalhando}
            onClick={() => setMenuAberto((aberto) => !aberto)}
          >
            <Icone name="add" />
          </Button>
          <AnimatePresence>
            {menuAberto ? (
              <motion.ul
                id={menuId}
                role="menu"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute bottom-full left-0 z-10 mb-2 min-w-48 border border-line bg-surface py-1"
              >
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={cn("flex min-h-10 w-full items-center gap-3 px-3 text-left text-sm hover:bg-surface-2", focusRing)}
                    onClick={() => {
                      setMenuAberto(false);
                      seletor.current?.click();
                    }}
                  >
                    <Icone name="clip" />
                    Anexar arquivo
                  </button>
                </li>
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </div>
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
          placeholder={
            desativado ? "Configure um provedor de IA para conversar" : ditado.ouvindo ? "Ouvindo… fale a mensagem" : "Pergunte ou peça algo"
          }
          className={cn(
            "order-first min-h-10 min-w-0 flex-1 basis-full resize-none bg-transparent px-2 py-2 text-base text-ink outline-none tab:order-none tab:basis-0",
            focusRing,
          )}
          onChange={(event) => onMudar(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              enviar();
            }
          }}
        />
        <div className="ml-auto flex items-center gap-2 tab:ml-0">
          {ditado.suportado ? (
            <Button
              type="button"
              variant="quiet"
              className={cn("size-10 px-0", ditado.ouvindo && "text-brand!")}
              aria-label={ditado.ouvindo ? "Parar de ouvir" : "Ditar a mensagem"}
              aria-pressed={ditado.ouvindo}
              disabled={desativado || trabalhando}
              onClick={alternarDitado}
            >
              <Icone name="mic" />
            </Button>
          ) : null}
          <AnimatePresence mode="wait" initial={false}>
            {trabalhando ? (
              <motion.span key="parar" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Button className="size-10 px-0" onClick={onParar} aria-label="Parar o assistente">
                  <Icone name="stop" />
                </Button>
              </motion.span>
            ) : (
              <motion.span key="enviar" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Button type="submit" variant="primary" className="size-10 px-0" disabled={!podeEnviar} aria-label="Enviar a mensagem">
                  <Icone name="send" />
                </Button>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className="flex flex-wrap justify-between gap-2 text-sm text-ink-2">
        <span className={cn(ditado.erro && "text-neg")}>
          {ditado.erro ||
            aviso ||
            (ditado.ouvindo
              ? "Ouvindo. O texto aparece na caixa; revise e envie. O áudio não é enviado, só o texto."
              : "Enter envia. Shift+Enter quebra a linha. Nada muda sem você aprovar o plano.")}
        </span>
        {restante < 400 ? <span className={cn(restante < 0 && "text-neg")}>{restante} caracteres</span> : null}
      </p>
    </form>
  );
}
