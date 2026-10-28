"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgenteIa,
  ConfiguracaoDeIa,
  ConversaCompleta,
  ConversaResumo,
  MensagemDoChat,
  UsuarioDaConta,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { cn, focusRing } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { Carregando } from "../../components/ui/esqueleto";
import { useToast } from "../../components/ui/toast";
import { Compositor } from "./compositor";
import { Conversas } from "./conversas";
import { ID_PROVISORIO, aplicarEvento, lerEventos, marcarResposta, mensagemProvisoria } from "./estado";
import { Mensagem } from "./mensagem";
import { Vazio } from "./vazio";

async function ler<T>(caminho: string): Promise<T> {
  const resposta = await fetch(caminho);
  const corpo = (await resposta.json().catch(() => ({}))) as T & { message?: string };
  if (!resposta.ok) throw new Error(corpo.message || "Não foi possível carregar.");
  return corpo;
}

function marcarNaUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("c", id);
  else url.searchParams.delete("c");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

type Inicio = { configuracao: ConfiguracaoDeIa | null; conversas: ConversaResumo[]; eu: UsuarioDaConta | null; aberta: ConversaCompleta | null };

async function carregarInicio(): Promise<Inicio> {
  const [configuracao, conversas, eu] = await Promise.all([
    ler<ConfiguracaoDeIa>("/api/ia/configuracao").catch(() => null),
    ler<ConversaResumo[]>("/api/assistente/conversas"),
    ler<UsuarioDaConta>("/api/auth/eu").catch(() => null),
  ]);
  const pedida = new URLSearchParams(window.location.search).get("c");
  const aberta = pedida && conversas.some((item) => item.id === pedida)
    ? await ler<ConversaCompleta>(`/api/assistente/conversas/${pedida}`).catch(() => null)
    : null;
  return { configuracao, conversas, eu, aberta };
}

export function Chat() {
  const toast = useToast();
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoDeIa | null>(null);
  const [nome, setNome] = useState("");
  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [atual, setAtual] = useState<ConversaResumo | null>(null);
  const [mensagens, setMensagens] = useState<MensagemDoChat[]>([]);
  const [trabalhando, setTrabalhando] = useState(false);
  const [agente, setAgente] = useState<AgenteIa | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [apagando, setApagando] = useState<ConversaResumo | null>(null);
  const [longe, setLonge] = useState(false);
  const parar = useRef<AbortController | null>(null);
  const seguir = useRef(true);
  const fim = useRef<HTMLDivElement>(null);
  const listaNoCelular = useRef<HTMLDialogElement>(null);
  const confirmarApagar = useRef<HTMLDialogElement>(null);

  const configurado = Boolean(configuracao?.assistente.padrao || configuracao?.assistente.funcoes.coordenador);

  const aplicarInicio = useCallback((inicio: Inicio) => {
    setConfiguracao(inicio.configuracao);
    setConversas(inicio.conversas);
    setNome(inicio.eu?.name.split(" ")[0] ?? "");
    if (inicio.aberta) {
      const { mensagens: lista, ...resumo } = inicio.aberta;
      setAtual(resumo);
      setMensagens(lista);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    let vivo = true;
    carregarInicio()
      .then((inicio) => {
        if (vivo) aplicarInicio(inicio);
      })
      .catch(() => {
        if (vivo) {
          setFalhou(true);
          setCarregando(false);
        }
      });
    return () => {
      vivo = false;
      parar.current?.abort();
    };
  }, [aplicarInicio]);

  // Acompanha a resposta enquanto ela chega, a menos que a pessoa tenha subido para ler.
  useEffect(() => {
    if (seguir.current) fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

  useEffect(() => {
    const medir = () => {
      const distancia = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      seguir.current = distancia < 160;
      setLonge(distancia > 480);
    };
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, []);

  async function recarregarLista() {
    const lista = await ler<ConversaResumo[]>("/api/assistente/conversas").catch(() => null);
    if (lista) setConversas(lista);
  }

  async function conversar(corpo: { texto: string } | { resposta: { perguntaId: string; escolha: string } }) {
    if (trabalhando) return;
    setTrabalhando(true);
    setAgente("coordenador");
    seguir.current = true;
    const texto = "texto" in corpo ? corpo.texto : "";
    if ("texto" in corpo) {
      setMensagens((lista) => [...lista, mensagemProvisoria(texto)]);
      setRascunho("");
    } else {
      setMensagens((lista) => marcarResposta(lista, corpo.resposta.perguntaId, corpo.resposta.escolha));
    }
    const controle = new AbortController();
    parar.current = controle;
    try {
      const resposta = await fetch("/api/assistente/mensagens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: atual?.id ?? null, ...corpo }),
        signal: controle.signal,
      });
      if (!resposta.ok) {
        const erro = (await resposta.json().catch(() => ({}))) as { message?: string };
        throw new Error(erro.message || "O assistente não respondeu.");
      }
      let assistenteId: string | null = null;
      for await (const evento of lerEventos(resposta)) {
        if (evento.tipo === "conversa") {
          setAtual(evento.conversa);
          setConversas((lista) => [evento.conversa, ...lista.filter((item) => item.id !== evento.conversa.id)]);
          marcarNaUrl(evento.conversa.id);
          continue;
        }
        if (evento.tipo === "erro") {
          toast.erro(evento.message);
          continue;
        }
        if (evento.tipo === "agente") setAgente(evento.agente);
        const id: string | null = assistenteId;
        setMensagens((lista) => aplicarEvento(lista, id, evento).mensagens);
        if (evento.tipo === "inicio") assistenteId = evento.assistenteId;
        if (evento.tipo === "fim") assistenteId = null;
      }
    } catch (error) {
      if (controle.signal.aborted) {
        toast.alerta("Parei. O que já foi feito continua feito.");
      } else {
        toast.erro(error instanceof Error ? error.message : "O assistente não respondeu.");
        if ("texto" in corpo) {
          setMensagens((lista) => lista.filter((item) => item.id !== ID_PROVISORIO));
          setRascunho(texto);
        }
      }
    } finally {
      parar.current = null;
      setTrabalhando(false);
      setAgente(null);
      await recarregarLista();
      // Depois de parar no meio, o servidor guardou o que deu tempo: a tela mostra o mesmo.
      if (controle.signal.aborted && atual?.id) await abrir(atual.id, true);
    }
  }

  async function abrir(id: string, forcar = false) {
    if ((trabalhando && !forcar) || (id === atual?.id && !forcar)) {
      listaNoCelular.current?.close();
      return;
    }
    try {
      const conversa = await ler<ConversaCompleta>(`/api/assistente/conversas/${id}`);
      const { mensagens: lista, ...resumo } = conversa;
      setAtual(resumo);
      setMensagens(lista);
      seguir.current = true;
      marcarNaUrl(id);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível abrir a conversa.");
    } finally {
      listaNoCelular.current?.close();
    }
  }

  function nova() {
    setAtual(null);
    setMensagens([]);
    setRascunho("");
    marcarNaUrl(null);
    listaNoCelular.current?.close();
  }

  async function apagar() {
    if (!apagando) return;
    const alvo = apagando;
    const resposta = await fetch(`/api/assistente/conversas/${alvo.id}`, { method: "DELETE" });
    confirmarApagar.current?.close();
    if (!resposta.ok && resposta.status !== 404) {
      toast.erro("Não foi possível apagar a conversa.");
      return;
    }
    setConversas((lista) => lista.filter((item) => item.id !== alvo.id));
    if (alvo.id === atual?.id) nova();
    toast.sucesso("Conversa apagada");
  }

  const ultimaDoAssistente = [...mensagens].reverse().find((item) => item.role === "assistant");
  const listaDeConversas = (
    <Conversas
      conversas={conversas}
      atual={atual?.id ?? null}
      trabalhando={trabalhando}
      onNova={nova}
      onAbrir={(id) => void abrir(id)}
      onApagar={(conversa) => {
        setApagando(conversa);
        confirmarApagar.current?.showModal();
      }}
    />
  );

  if (falhou) {
    return (
      <div className="grid max-w-prose gap-4">
        <p>Não foi possível abrir o assistente.</p>
        <div>
          <Button onClick={() => window.location.reload()}>Tentar de novo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 desk:grid-cols-4">
      <aside className="hidden desk:sticky desk:top-8 desk:block desk:self-start">{listaDeConversas}</aside>

      {/* A seção ocupa a altura da tela: com conversa curta, a caixa de mensagem fica no rodapé, como nos chats. */}
      <section className="flex min-h-dvh min-w-0 flex-col gap-6 desk:col-span-3" aria-label="Conversa com o assistente">
        <header className="flex items-end justify-between gap-3 border-b border-line pb-3">
          <div className="grid min-w-0 gap-1">
            <p className="etiqueta text-brand">Assistente</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={atual?.id ?? "nova"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="truncate font-display text-xl"
              >
                {atual?.title ?? "Nova conversa"}
              </motion.h1>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button className="desk:hidden" onClick={() => listaNoCelular.current?.showModal()}>
              Conversas
            </Button>
            {mensagens.length ? (
              <Button variant="quiet" onClick={nova} disabled={trabalhando}>
                Nova
              </Button>
            ) : null}
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6">
          {carregando ? (
            <Carregando texto="Abrindo o assistente" linhas={3} />
          ) : mensagens.length === 0 ? (
            <Vazio
              configurado={configurado}
              podeConfigurar={Boolean(configuracao?.podeEditar)}
              nome={nome}
              onSugerir={(texto) => void conversar({ texto })}
            />
          ) : (
            <ul className="grid gap-8" aria-live="polite">
              {mensagens.map((mensagem) => (
                <Mensagem
                  key={mensagem.id}
                  mensagem={mensagem}
                  viva={trabalhando && mensagem.id === ultimaDoAssistente?.id && mensagem === mensagens[mensagens.length - 1]}
                  agenteAtual={agente}
                  podeResponder={!trabalhando && mensagem.id === ultimaDoAssistente?.id}
                  onResponder={(perguntaId, escolha) => void conversar({ resposta: { perguntaId, escolha } })}
                />
              ))}
            </ul>
          )}
          <div ref={fim} />
        </div>

        <div className="sticky bottom-0 z-10 bg-bg pt-3 pb-4">
          <div className="relative mx-auto w-full max-w-3xl">
            <AnimatePresence>
              {longe ? (
                <motion.button
                  key="descer"
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  onClick={() => fim.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
                  className={cn(
                    "etiqueta absolute -top-12 left-1/2 min-h-10 -translate-x-1/2 border border-line bg-surface px-3 text-ink-2 hover:text-ink",
                    focusRing,
                  )}
                >
                  Ir para o fim
                </motion.button>
              ) : null}
            </AnimatePresence>
            <Compositor
              valor={rascunho}
              trabalhando={trabalhando}
              desativado={!carregando && !configurado}
              aviso=""
              onMudar={setRascunho}
              onEnviar={() => void conversar({ texto: rascunho.trim() })}
              onParar={() => parar.current?.abort()}
            />
          </div>
        </div>
      </section>

      <Dialogo ref={listaNoCelular} aria-label="Conversas">
        <div className="dialog-corpo grid gap-4">
          <h2 className="font-display text-lg">Conversas</h2>
          {listaDeConversas}
        </div>
        <div className="dialog-acoes">
          <Button variant="quiet" onClick={() => listaNoCelular.current?.close()}>
            Fechar
          </Button>
        </div>
      </Dialogo>

      <Dialogo ref={confirmarApagar} aria-labelledby="titulo-apagar-conversa" onClose={() => setApagando(null)}>
        <div className="dialog-corpo grid gap-4">
          <h2 id="titulo-apagar-conversa" className="font-display text-lg">
            Apagar esta conversa?
          </h2>
          <p>{apagando?.title}</p>
          <p className="text-sm text-ink-2">O que o assistente já fez no sistema continua feito.</p>
        </div>
        <div className="dialog-acoes">
          <Button variant="quiet" onClick={() => confirmarApagar.current?.close()}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void apagar()}>
            Apagar
          </Button>
        </div>
      </Dialogo>
    </div>
  );
}
