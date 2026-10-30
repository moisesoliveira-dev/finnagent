import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import type { ConversaCompleta, ConversaResumo, MensagemDoChat } from "@finnagent/contracts";
import { AnimatePresence, motion } from "motion/react";
import { addOutline, closeOutline, listOutline, sendOutline, stopOutline } from "ionicons/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { abrirFluxo, enviar, ler } from "../api/cliente";
import { ID_PROVISORIO, aplicarEvento, lerEventos, marcarResposta, mensagemProvisoria } from "@finnagent/chat";
import { MensagemDaConversa } from "../assistente/Mensagem";
import { Simbolo } from "../componentes/Simbolo";
import { toque } from "../haptico";
import { Bloco, Cascata, curvaSaida, toqueDoDedo } from "../movimento";

const SUGESTOES = ["Quanto gastei este mês e com o quê?", "Recebo meu salário todo dia 30", "Crie uma meta de R$ 5.000 para uma viagem", "Quais grupos e sessões eu tenho?"];

export function Assistente() {
  const [lista, setLista] = useState<ConversaResumo[]>([]);
  const [atual, setAtual] = useState<ConversaResumo | null>(null);
  const [mensagens, setMensagens] = useState<MensagemDoChat[]>([]);
  const [texto, setTexto] = useState("");
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState("");
  const [listaAberta, setListaAberta] = useState(false);
  const conteudo = useRef<HTMLIonContentElement>(null);
  const controle = useRef<AbortController | null>(null);
  const atualId = useRef<string | null>(null);
  const acompanhando = useRef(0);
  // O fluxo roda fora do render: lê sempre a lista mais nova.
  const mensagensRef = useRef<MensagemDoChat[]>([]);
  mensagensRef.current = mensagens;

  const recarregarLista = useCallback(async () => {
    try {
      setLista(await ler<ConversaResumo[]>("/api/assistente/conversas"));
    } catch {
      // A lista é só atalho: sem ela a conversa aberta continua funcionando.
    }
  }, []);

  const descer = useCallback(() => {
    requestAnimationFrame(() => void conteudo.current?.scrollToBottom(150));
  }, []);

  /** O servidor segue respondendo mesmo sem a tela: enquanto "em andamento", vai buscando o que já foi feito. */
  const acompanhar = useCallback(
    async (id: string) => {
      const eu = ++acompanhando.current;
      setTrabalhando(true);
      try {
        for (let volta = 0; volta < 90 && eu === acompanhando.current; volta++) {
          await new Promise((resolver) => setTimeout(resolver, 2000));
          if (eu !== acompanhando.current) return;
          const conversa = await ler<ConversaCompleta>(`/api/assistente/conversas/${id}`);
          if (atualId.current !== id) return;
          setMensagens(conversa.mensagens);
          descer();
          if (!conversa.emAndamento) return;
        }
      } catch {
        // Sem rede por um momento: a próxima abertura da conversa mostra o que ficou.
      } finally {
        if (eu === acompanhando.current) setTrabalhando(false);
      }
    },
    [descer],
  );

  const abrir = useCallback(
    async (id: string) => {
      acompanhando.current++;
      try {
        const { mensagens: msgs, ...resumo } = await ler<ConversaCompleta>(`/api/assistente/conversas/${id}`);
        atualId.current = id;
        setAtual(resumo);
        setMensagens(msgs);
        setErro("");
        descer();
        if (resumo.emAndamento) void acompanhar(id);
        else setTrabalhando(false);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível abrir a conversa.");
      }
    },
    [acompanhar, descer],
  );

  // Ao voltar para a aba: se o servidor ainda está respondendo uma conversa, abre ela.
  useEffect(() => {
    void (async () => {
      try {
        const conversas = await ler<ConversaResumo[]>("/api/assistente/conversas");
        setLista(conversas);
        const rodando = conversas.find((item) => item.emAndamento);
        if (rodando) await abrir(rodando.id);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível carregar.");
      }
    })();
  }, [abrir]);

  useIonViewWillEnter(() => {
    void recarregarLista();
    if (atualId.current && !controle.current) void abrir(atualId.current);
  });

  function nova() {
    controle.current?.abort();
    acompanhando.current++;
    atualId.current = null;
    setAtual(null);
    setMensagens([]);
    setTrabalhando(false);
    setErro("");
    setListaAberta(false);
  }

  async function conversar(corpo: { texto: string } | { resposta: { perguntaId: string; escolha: string } }) {
    if (trabalhando) return;
    acompanhando.current++;
    setTrabalhando(true);
    setErro("");
    const digitado = "texto" in corpo ? corpo.texto : "";
    if ("texto" in corpo) {
      setMensagens((itens) => [...itens, mensagemProvisoria(digitado)]);
      setTexto("");
    } else {
      setMensagens((itens) => marcarResposta(itens, corpo.resposta.perguntaId, corpo.resposta.escolha));
    }
    descer();

    const parar = new AbortController();
    controle.current = parar;
    let conversaId = atualId.current;
    let assistenteId: string | null = null;
    let terminou = false;
    try {
      const resposta = await abrirFluxo("/api/assistente/mensagens", { conversationId: conversaId, ...corpo }, parar.signal);
      try {
        for await (const evento of lerEventos(resposta)) {
          if (evento.tipo === "conversa") {
            conversaId = evento.conversa.id;
            atualId.current = conversaId;
            setAtual(evento.conversa);
            continue;
          }
          if (evento.tipo === "erro") {
            setErro(evento.message);
            continue;
          }
          const proximo = aplicarEvento(mensagensRef.current, assistenteId, evento);
          assistenteId = proximo.assistenteId;
          setMensagens(proximo.mensagens);
          descer();
          if (evento.tipo === "fim") terminou = true;
        }
      } catch (error) {
        if (parar.signal.aborted) throw error;
      }
      // Sem o "fim" a conexão caiu, mas o servidor continua: passa a acompanhar.
      if (!terminou && conversaId && !parar.signal.aborted) {
        controle.current = null;
        await acompanhar(conversaId);
      }
    } catch (error) {
      if (parar.signal.aborted) setErro("Parei. O que já foi feito continua feito.");
      else {
        setErro(error instanceof Error ? error.message : "O assistente não respondeu.");
        if ("texto" in corpo) {
          setMensagens((itens) => itens.filter((item) => item.id !== ID_PROVISORIO));
          setTexto(digitado);
        }
      }
    } finally {
      if (controle.current === parar) controle.current = null;
      setTrabalhando(false);
      void recarregarLista();
      if (parar.signal.aborted && conversaId) await abrir(conversaId);
    }
  }

  async function parar() {
    controle.current?.abort();
    const id = atualId.current;
    if (id) await enviar<void>(`/api/assistente/conversas/${id}/parar`, {}).catch(() => undefined);
  }

  const ultima = mensagens[mensagens.length - 1];
  const vazio = mensagens.length === 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <span slot="start" style={{ display: "inline-flex" }}>
            <Simbolo altura={28} />
          </span>
          <IonTitle>Consultor</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Conversas" onClick={() => setListaAberta(true)}>
              <IonIcon slot="icon-only" icon={listOutline} />
            </IonButton>
            <IonButton aria-label="Nova conversa" onClick={nova}>
              <IonIcon slot="icon-only" icon={addOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={conteudo}>
        {vazio ? (
          <Cascata className="pagina">
            <Bloco className="secao">
              {/* O quadrado cai no lugar, como o peso de um prumo. */}
              <motion.span
                className="marca"
                aria-hidden
                style={{ justifySelf: "start" }}
                initial={{ y: -40, opacity: 0, rotate: -20 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 11, delay: 0.1 }}
              />
              <h2 className="titulo">Como posso ajudar?</h2>
              <p className="fraco">O consultor entende o pedido, mostra o plano com o efeito no seu mês e só muda algo depois que você aprova.</p>
            </Bloco>
            <Bloco className="secao">
              <span className="etiqueta">Comece por aqui</span>
              {SUGESTOES.map((sugestao) => (
                <motion.button
                  key={sugestao}
                  type="button"
                  className="sugestao"
                  whileTap={toqueDoDedo}
                  onClick={() => {
                    toque();
                    void conversar({ texto: sugestao });
                  }}
                >
                  {sugestao}
                </motion.button>
              ))}
            </Bloco>
          </Cascata>
        ) : (
          <div className="conversa">
            {mensagens.map((mensagem) => (
              <MensagemDaConversa
                key={mensagem.id}
                mensagem={mensagem}
                ativa={mensagem === ultima && !trabalhando}
                aoResponder={(escolha) => {
                  const pergunta = mensagem.partes.find((parte) => parte.tipo === "pergunta" && parte.pergunta.resposta === null);
                  if (pergunta?.tipo === "pergunta") void conversar({ resposta: { perguntaId: pergunta.pergunta.id, escolha } });
                }}
              />
            ))}
            <AnimatePresence>
              {trabalhando ? (
                <motion.div
                  key="digitando"
                  className="digitando"
                  role="status"
                  aria-label="O consultor está trabalhando"
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: curvaSaida }}
                >
                  {[0, 1, 2].map((indice) => (
                    <motion.span key={indice} animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1, delay: indice * 0.15, ease: "easeInOut" }} />
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )}
        {erro ? (
          <p className="erro" style={{ margin: 16 }} role="alert">
            {erro}
          </p>
        ) : null}
      </IonContent>

      <IonFooter>
        <form
          className="compositor"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (texto.trim()) void conversar({ texto: texto.trim() });
          }}
        >
          <textarea
            rows={1}
            value={texto}
            placeholder="Escreva para o assistente"
            aria-label="Mensagem para o assistente"
            onChange={(evento) => setTexto(evento.target.value)}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={trabalhando ? "parar" : "enviar"}
              initial={{ opacity: 0, scale: 0.7, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.7, rotate: 30 }}
              transition={{ duration: 0.16 }}
              whileTap={toqueDoDedo}
            >
              {trabalhando ? (
                <IonButton fill="outline" aria-label="Parar" onClick={() => void parar()}>
                  <IonIcon slot="icon-only" icon={stopOutline} />
                </IonButton>
              ) : (
                <IonButton type="submit" className="principal" aria-label="Enviar" disabled={!texto.trim()} onClick={() => toque()}>
                  <IonIcon slot="icon-only" icon={sendOutline} />
                </IonButton>
              )}
            </motion.div>
          </AnimatePresence>
        </form>
      </IonFooter>

      <IonModal isOpen={listaAberta} onDidDismiss={() => setListaAberta(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Conversas</IonTitle>
            <IonButtons slot="end">
              <IonButton aria-label="Fechar" onClick={() => setListaAberta(false)}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="pagina">
            {lista.length === 0 ? <p className="fraco">Nenhuma conversa ainda.</p> : null}
            <div className="lista">
              {lista.map((conversa) => (
                <button
                  key={conversa.id}
                  type="button"
                  className="linha"
                  onClick={() => {
                    setListaAberta(false);
                    void abrir(conversa.id);
                  }}
                >
                  <div className="texto">
                    <span>{conversa.title}</span>
                    <span className="etiqueta">
                      {conversa.emAndamento ? "Trabalhando" : conversa.pendente ? "Espera sua resposta" : new Date(conversa.updatedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
}
