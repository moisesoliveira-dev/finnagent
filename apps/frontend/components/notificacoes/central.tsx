"use client";

import {
  ROTULO_DO_TIPO_DE_NOTIFICACAO,
  rotaWebDoDestino,
  type Notificacao,
  type NotificacoesResposta,
} from "@finnagent/contracts";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { cn, focusRing } from "../ui/cn";
import { Dialogo } from "../ui/dialogo";
import { Esqueleto } from "../ui/esqueleto";
import { Icone } from "../ui/icone";
import { ItemAnimado, ListaAnimada, mola, useCurva } from "../ui/movimento";
import { useToast } from "../ui/toast";
import { Vazio } from "../ui/vazio";

const A_CADA_MS = 60_000;

async function ler<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, init);
  const corpo = (await resposta.json().catch(() => ({}))) as T & { message?: string };
  if (!resposta.ok) throw new Error(corpo.message || "Não foi possível carregar as notificações.");
  return corpo;
}

/** "agora", "há 5 min", "há 2 h", "ontem" ou o dia. */
export function quando(iso: string, agora = Date.now()) {
  const minutos = Math.floor((agora - Date.parse(iso)) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  if (horas < 48) return "ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(new Date(iso));
}

/** O sino da navegação: conta as não lidas e abre a central. */
export function SinoDoMenu() {
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const curva = useCurva();

  const contar = useCallback(() => {
    fetch("/api/notificacoes/contagem")
      .then((resposta) => (resposta.ok ? (resposta.json() as Promise<{ naoLidas: number }>) : null))
      .then((corpo) => {
        if (corpo) setNaoLidas(corpo.naoLidas);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    contar();
    const relogio = setInterval(() => {
      if (document.visibilityState === "visible") contar();
    }, A_CADA_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") contar();
    };
    // O service worker avisa quando chega um push.
    const doWorker = (evento: MessageEvent) => {
      if ((evento.data as { tipo?: string } | null)?.tipo === "notificacao") contar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    navigator.serviceWorker?.addEventListener("message", doWorker);
    return () => {
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      navigator.serviceWorker?.removeEventListener("message", doWorker);
    };
  }, [contar]);

  const rotulo = naoLidas === 0 ? "Notificações" : `Notificações, ${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}`;
  return (
    <>
      <motion.button
        type="button"
        aria-label={rotulo}
        aria-haspopup="dialog"
        title="Notificações"
        onClick={() => setAberto(true)}
        whileTap={{ scale: 0.92 }}
        className={cn("relative inline-flex size-10 shrink-0 items-center justify-center text-ink-2 transition-colors hover:text-ink", focusRing)}
      >
        <motion.span
          key={naoLidas}
          className="inline-flex"
          initial={naoLidas > 0 ? { rotate: -14 } : false}
          animate={{ rotate: [-14, 12, -8, 0] }}
          transition={{ ...curva, duration: curva.duration === 0 ? 0 : 0.5 }}
        >
          <Icone name="bell" />
        </motion.span>
        <AnimatePresence>
          {naoLidas > 0 ? (
            <motion.span
              key="contador"
              aria-hidden
              className="etiqueta absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-brand-ink"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={mola}
            >
              {naoLidas > 99 ? "99+" : naoLidas}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.button>
      <CentralDeNotificacoes aberto={aberto} aoFechar={() => setAberto(false)} aoMudarContagem={setNaoLidas} />
    </>
  );
}

function CentralDeNotificacoes({
  aberto,
  aoFechar,
  aoMudarContagem,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoMudarContagem: (total: number) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [pagina, setPagina] = useState<NotificacoesResposta | null>(null);
  const [erro, setErro] = useState("");
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [lendoTodas, setLendoTodas] = useState(false);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await ler<NotificacoesResposta>("/api/notificacoes");
      setPagina(resposta);
      aoMudarContagem(resposta.naoLidas);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar as notificações.");
    }
  }, [aoMudarContagem]);

  // Ao abrir, atualiza a lista. A anterior fica na tela enquanto a nova chega.
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    ler<NotificacoesResposta>("/api/notificacoes")
      .then((resposta) => {
        if (!vivo) return;
        setErro("");
        setPagina(resposta);
        aoMudarContagem(resposta.naoLidas);
      })
      .catch((error: unknown) => {
        if (vivo) setErro(error instanceof Error ? error.message : "Não foi possível carregar as notificações.");
      });
    return () => {
      vivo = false;
    };
  }, [aberto, aoMudarContagem]);

  async function carregarMais() {
    if (!pagina?.proxima) return;
    setMaisCarregando(true);
    try {
      const resposta = await ler<NotificacoesResposta>(`/api/notificacoes?antes=${encodeURIComponent(pagina.proxima)}`);
      setPagina({ ...resposta, itens: [...pagina.itens, ...resposta.itens] });
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível carregar mais.");
    } finally {
      setMaisCarregando(false);
    }
  }

  function marcarLocal(id: string | null) {
    setPagina((atual) => {
      if (!atual) return atual;
      const agora = new Date().toISOString();
      const itens = atual.itens.map((item) => (id === null || item.id === id ? { ...item, lidaEm: item.lidaEm ?? agora } : item));
      const naoLidas = id === null ? 0 : Math.max(atual.naoLidas - (atual.itens.some((item) => item.id === id && !item.lidaEm) ? 1 : 0), 0);
      aoMudarContagem(naoLidas);
      return { ...atual, itens, naoLidas };
    });
  }

  function abrir(item: Notificacao) {
    if (!item.lidaEm) {
      marcarLocal(item.id);
      void fetch(`/api/notificacoes/${item.id}/lida`, { method: "POST" }).catch(() => undefined);
    }
    aoFechar();
    router.push(rotaWebDoDestino(item.destino));
  }

  async function lerTodas() {
    setLendoTodas(true);
    try {
      await ler("/api/notificacoes/lidas", { method: "POST" });
      marcarLocal(null);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível marcar como lidas.");
    } finally {
      setLendoTodas(false);
    }
  }

  return (
    <Dialogo
      ref={dialogo}
      aberto={aberto}
      largura="media"
      aria-labelledby="titulo-notificacoes-central"
      onClose={aoFechar}
      onClick={(evento) => {
        if (evento.target === dialogo.current) aoFechar();
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 id="titulo-notificacoes-central" className="font-display text-lg">
            Notificações
          </h2>
          <p className="text-sm text-ink-2" aria-live="polite">
            {pagina ? (pagina.naoLidas === 0 ? "Tudo lido." : `${pagina.naoLidas} não ${pagina.naoLidas === 1 ? "lida" : "lidas"}.`) : " "}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="quiet" onClick={() => void lerTodas()} carregando={lendoTodas} disabled={!pagina || pagina.naoLidas === 0}>
            {lendoTodas ? "Marcando" : "Marcar todas"}
          </Button>
          <Button variant="quiet" className="min-w-10 px-0" aria-label="Fechar" onClick={aoFechar}>
            ×
          </Button>
        </div>
      </div>

      <div className="dialog-corpo">
        {erro ? (
          <div className="grid gap-3">
            <p role="alert" className="text-sm text-neg">
              {erro}
            </p>
            <Button onClick={() => void carregar()} className="justify-self-start">
              Tentar de novo
            </Button>
          </div>
        ) : !pagina ? (
          <div className="grid gap-2" aria-busy="true" aria-label="Carregando as notificações">
            <Esqueleto className="h-16" />
            <Esqueleto className="h-16" />
            <Esqueleto className="h-16" />
          </div>
        ) : pagina.itens.length === 0 ? (
          <Vazio>Nada por aqui. Vencimentos, lembretes, extratos, metas e planos do assistente aparecem nesta lista.</Vazio>
        ) : (
          <ListaAnimada className="grid rounded-lg border border-line bg-surface">
            {pagina.itens.map((item) => (
              <ItemAnimado key={item.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => abrir(item)}
                  className={cn(
                    "flex w-full min-w-0 gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2",
                    focusRing,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("mt-2 size-2 shrink-0 rounded-full", item.lidaEm ? "bg-transparent" : "bg-brand")}
                  />
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className={cn("min-w-0 truncate", item.lidaEm ? "text-ink-2" : "font-semibold text-ink")}>
                        {item.titulo}
                      </span>
                      <time dateTime={item.criadaEm} className="etiqueta shrink-0 text-ink-2">
                        {quando(item.criadaEm)}
                      </time>
                    </span>
                    <span className="text-sm text-ink-2">{item.texto}</span>
                    <span className="etiqueta text-ink-2">
                      {ROTULO_DO_TIPO_DE_NOTIFICACAO[item.tipo].titulo}
                      {item.lidaEm ? null : <span className="sr-only">, não lida</span>}
                    </span>
                  </span>
                </button>
              </ItemAnimado>
            ))}
          </ListaAnimada>
        )}
        {pagina?.proxima ? (
          <Button className="mt-3 w-full" onClick={() => void carregarMais()} carregando={maisCarregando}>
            {maisCarregando ? "Carregando" : "Carregar mais"}
          </Button>
        ) : null}
      </div>

      <div className="dialog-acoes">
        <Link
          href="/configuracoes?secao=notificacoes"
          onClick={aoFechar}
          className={cn("etiqueta-botao inline-flex min-h-10 items-center text-brand underline-offset-4 hover:underline", focusRing)}
        >
          Escolher o que receber
        </Link>
      </div>
    </Dialogo>
  );
}
