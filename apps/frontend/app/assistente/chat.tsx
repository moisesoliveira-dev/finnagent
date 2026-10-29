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
  // Voltando para a aba sem ?c=, abre a conversa que o servidor ainda está respondendo: ela não se perde.
  const pedida = new URLSearchParams(window.location.search).get("c") ?? conversas.find((item) => item.emAndamento)?.id ?? null;
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
  const [atual, setAtualEstado] = useState<ConversaResumo | null>(null);
  // Em que conversa o turno em curso está (null: ainda não começou ou nenhum). A tela só mostra o andamento nela.
  const [turnoEm, setTurnoEm] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemDoChat[]>([]);
  const [trabalhando, setTrabalhando] = useState(false);
  const [agente, setAgente] = useState<AgenteIa | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [apagando, setApagando] = useState<ConversaResumo | null>(null);
  const [longe, setLonge] = useState(false);
  const parar = useRef<AbortController | null>(null);
  const conversaDoTurno = useRef<string | null>(null);
  const pediuParar = useRef(false);
  // A pessoa saiu da aba ou abriu outra conversa: a tela solta a conexão, mas o servidor segue. Não é "parar".
  const soltou = useRef(false);
  const atualId = useRef<string | null>(null);
  const seguir = useRef(true);
  const fim = useRef<HTMLDivElement>(null);
  const listaNoCelular = useRef<HTMLDialogElement>(null);
  const confirmarApagar = useRef<HTMLDialogElement>(null);

  function setAtual(conversa: ConversaResumo | null) {
    atualId.current = conversa?.id ?? null;
    setAtualEstado(conversa);
  }

  // O andamento só aparece na conversa em que o turno roda.
  const aqui = trabalhando && (turnoEm === null || turnoEm === atual?.id);

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
        if (!vivo) return;
        aplicarInicio(inicio);
        if (inicio.aberta?.emAndamento) void seguirTurno(inicio.aberta.id);
      })
      .catch(() => {
        if (vivo) {
          setFalhou(true);
          setCarregando(false);
        }
      });
    return () => {
      vivo = false;
      soltou.current = true;
      parar.current?.abort();
    };
    // seguirTurno só lê estado novo por refs; roda uma vez ao abrir a tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicarInicio]);

  // Conversa rodando em segundo plano: mantém a lista em dia até o servidor terminar.
  useEffect(() => {
    if (!conversas.some((item) => item.emAndamento) || trabalhando) return;
    const espera = setTimeout(() => void recarregarLista(), 4000);
    return () => clearTimeout(espera);
  }, [conversas, trabalhando]);

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

  /** O turno roda no servidor e sobrevive à conexão: parar é um pedido a ele, não fechar o fetch. */
  function pararTurno() {
    pediuParar.current = true;
    pedirParada();
  }

  function pedirParada() {
    const id = conversaDoTurno.current;
    if (id) void fetch(`/api/assistente/conversas/${id}/parar`, { method: "POST" }).catch(() => parar.current?.abort());
  }

  /** Depois que a conexão cai, o servidor segue respondendo: espera ele terminar e mostra o resultado. */
  async function acompanhar(id: string, controle: AbortController) {
    for (let tentativa = 0; tentativa < 150 && !controle.signal.aborted; tentativa += 1) {
      await new Promise((resolver) => setTimeout(resolver, 2500));
      const conversa = await ler<ConversaCompleta>(`/api/assistente/conversas/${id}`).catch(() => null);
      if (!conversa) continue;
      const { mensagens: lista, ...resumo } = conversa;
      if (atualId.current === id) {
        setAtual(resumo);
        setMensagens(lista);
      }
      if (conversa.emAndamento) continue;
      return lista.at(-1)?.role === "assistant";
    }
    return false;
  }

  /** Voltou para uma conversa que o servidor ainda responde: mostra que ele continua e espera o resultado. */
  async function seguirTurno(id: string) {
    const controle = new AbortController();
    parar.current = controle;
    conversaDoTurno.current = id;
    soltou.current = false;
    pediuParar.current = false;
    setTurnoEm(id);
    setTrabalhando(true);
    setAgente("coordenador");
    try {
      await acompanhar(id, controle);
    } finally {
      if (parar.current === controle) {
        parar.current = null;
        conversaDoTurno.current = null;
        setTurnoEm(null);
        setTrabalhando(false);
        setAgente(null);
      }
      await recarregarLista();
    }
  }

  /** Sai da conversa que está rodando sem pará-la: o servidor termina o que começou. */
  function soltarTurno() {
    if (!parar.current) return;
    soltou.current = true;
    parar.current.abort();
  }

  async function conversar(corpo: { texto: string } | { resposta: { perguntaId: string; escolha: string } }) {
    if (trabalhando) {
      toast.alerta("O assistente ainda está trabalhando. Espere ele terminar ou pare a resposta.");
      return;
    }
    soltou.current = false;
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
    conversaDoTurno.current = atual?.id ?? null;
    setTurnoEm(atual?.id ?? null);
    pediuParar.current = false;
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
      let conversaId = atual?.id ?? null;
      let terminou = false;
      try {
        for await (const evento of lerEventos(resposta)) {
          if (evento.tipo === "conversa") {
            conversaId = evento.conversa.id;
            conversaDoTurno.current = conversaId;
            setTurnoEm(conversaId);
            if (pediuParar.current) pedirParada();
            setAtual(evento.conversa);
            setConversas((lista) => [evento.conversa, ...lista.filter((item) => item.id !== evento.conversa.id)]);
            marcarNaUrl(evento.conversa.id);
            continue;
          }
          if (evento.tipo === "erro") {
            toast.erro(evento.message);
            continue;
          }
          // Se a pessoa abriu outra conversa no meio, o andamento não entra nela.
          const naTela = !conversaId || atualId.current === conversaId;
          if (evento.tipo === "agente" && naTela) setAgente(evento.agente);
          const id: string | null = assistenteId;
          if (naTela) setMensagens((lista) => aplicarEvento(lista, id, evento).mensagens);
          if (evento.tipo === "inicio") assistenteId = evento.assistenteId;
          if (evento.tipo === "fim") {
            assistenteId = null;
            terminou = true;
          }
        }
      } catch (error) {
        // Conexão perdida no meio: o servidor não parou, então cai na retomada abaixo.
        if (controle.signal.aborted) throw error;
      }
      if (terminou && pediuParar.current) toast.alerta("Parei. O que já foi feito continua feito.");
      // Sem o `fim`, a conexão caiu (proxy, rede, servidor lento), mas o turno segue no servidor.
      if (!terminou && !controle.signal.aborted && !soltou.current) {
        if (!conversaId) {
          toast.erro("A conexão caiu antes de a conversa começar. Envie de novo.");
        } else {
          toast.alerta("A conexão caiu, mas o assistente continua. Vou mostrar a resposta quando ele terminar.");
          const concluiu = await acompanhar(conversaId, controle);
          if (!concluiu && !controle.signal.aborted) toast.erro("O servidor não terminou essa resposta. Envie de novo.");
        }
      }
    } catch (error) {
      if (soltou.current) {
        // A pessoa saiu da conversa ou da aba: o servidor segue, não há nada a avisar.
      } else if (controle.signal.aborted) {
        toast.alerta("Parei. O que já foi feito continua feito.");
      } else {
        toast.erro(error instanceof Error ? error.message : "O assistente não respondeu.");
        if ("texto" in corpo) {
          setMensagens((lista) => lista.filter((item) => item.id !== ID_PROVISORIO));
          setRascunho(texto);
        }
      }
    } finally {
      // Outra retomada pode já ter assumido o lugar desta: só quem é dono do controle limpa o estado.
      if (parar.current === controle) {
        parar.current = null;
        conversaDoTurno.current = null;
        setTurnoEm(null);
        setTrabalhando(false);
        setAgente(null);
      }
      if (!soltou.current) await recarregarLista();
      // Depois de parar no meio, o servidor guardou o que deu tempo: a tela mostra o mesmo.
      if (controle.signal.aborted && !soltou.current && atual?.id) await abrir(atual.id, true);
    }
  }

  async function abrir(id: string, forcar = false) {
    if (id === atual?.id && !forcar) {
      listaNoCelular.current?.close();
      return;
    }
    // Trocar de conversa não para o assistente: ele continua no servidor e a lista mostra "Trabalhando".
    if (!forcar && trabalhando && turnoEm !== id) soltarTurno();
    try {
      const conversa = await ler<ConversaCompleta>(`/api/assistente/conversas/${id}`);
      const { mensagens: lista, ...resumo } = conversa;
      setAtual(resumo);
      setMensagens(lista);
      seguir.current = true;
      marcarNaUrl(id);
      if (conversa.emAndamento && !(parar.current && conversaDoTurno.current === id)) void seguirTurno(id);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível abrir a conversa.");
    } finally {
      listaNoCelular.current?.close();
    }
  }

  function nova() {
    if (trabalhando) soltarTurno();
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
      trabalhando={false}
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
              <Button variant="quiet" onClick={nova}>
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
                  viva={aqui && mensagem.id === ultimaDoAssistente?.id && mensagem === mensagens[mensagens.length - 1]}
                  agenteAtual={agente}
                  podeResponder={!trabalhando && mensagem.id === ultimaDoAssistente?.id}
                  onResponder={(perguntaId, escolha) => void conversar({ resposta: { perguntaId, escolha } })}
                />
              ))}
            </ul>
          )}
          {aqui && mensagens.at(-1)?.role === "user" ? (
            <p className="etiqueta text-brand" aria-live="polite">
              O assistente continua trabalhando nesta conversa
            </p>
          ) : null}
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
              trabalhando={aqui}
              desativado={!carregando && !configurado}
              aviso=""
              onMudar={setRascunho}
              onEnviar={() => void conversar({ texto: rascunho.trim() })}
              onParar={pararTurno}
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
