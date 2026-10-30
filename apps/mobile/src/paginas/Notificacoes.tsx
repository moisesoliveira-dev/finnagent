import { IonButton, IonButtons, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, useIonToast, useIonViewWillEnter } from "@ionic/react";
import { ROTULO_DO_TIPO_DE_NOTIFICACAO, type Notificacao, type NotificacoesResposta } from "@finnagent/contracts";
import { checkmarkDoneOutline, chevronBack, notificationsOffOutline, settingsOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { enviar, ler, pedir } from "../api/cliente";
import { Estado, Vazio } from "../componentes/Estado";
import { Pagina } from "../componentes/Pagina";
import { toque } from "../haptico";
import { Bloco, Cascata, toqueDoDedo } from "../movimento";
import { definirNaoLidas } from "../notificacoes/contagem";
import { rotaDoApp } from "../notificacoes/destino";
import { useDados } from "../useDados";

/** "agora", "há 5 min", "há 2 h", "ontem" ou o dia. */
function quando(iso: string, agora = Date.now()) {
  const minutos = Math.floor((agora - Date.parse(iso)) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  if (horas < 48) return "ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(new Date(iso));
}

export function Notificacoes() {
  const navegar = useNavigate();
  const [avisar] = useIonToast();
  const { dados, erro, carregando, recarregar } = useDados<NotificacoesResposta>("/api/notificacoes");
  // A página seguinte e o que a pessoa leu aqui ficam por cima do que veio do servidor.
  const [mais, setMais] = useState<{ base: NotificacoesResposta; itens: Notificacao[]; proxima: string | null } | null>(null);
  const [lidas, setLidas] = useState<{ base: NotificacoesResposta; ids: Set<string>; todas: boolean } | null>(null);
  const [lendoTodas, setLendoTodas] = useState(false);

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });

  const extra = mais && mais.base === dados ? mais : null;
  const marcadas = lidas && lidas.base === dados ? lidas : null;
  const lida = (item: Notificacao) => Boolean(item.lidaEm) || Boolean(marcadas?.todas) || Boolean(marcadas?.ids.has(item.id));
  const itens = dados ? [...dados.itens, ...(extra?.itens ?? [])] : [];
  const proxima = extra ? extra.proxima : (dados?.proxima ?? null);
  const naoLidas = dados ? (marcadas?.todas ? 0 : Math.max(dados.naoLidas - (marcadas?.ids.size ?? 0), 0)) : 0;
  // O sino das outras telas acompanha o que foi lido aqui.
  useEffect(() => {
    if (dados) definirNaoLidas(naoLidas);
  }, [dados, naoLidas]);

  async function carregarMais(evento: CustomEvent<void>) {
    if (!dados || !proxima) {
      await (evento.target as HTMLIonInfiniteScrollElement).complete();
      return;
    }
    try {
      const pagina = await ler<NotificacoesResposta>(`/api/notificacoes?antes=${encodeURIComponent(proxima)}`);
      setMais({ base: dados, itens: [...(extra?.itens ?? []), ...pagina.itens], proxima: pagina.proxima });
    } catch {
      void avisar({ message: "Não foi possível carregar mais.", duration: 2400, position: "top", cssClass: "aviso-de-erro" });
    } finally {
      await (evento.target as HTMLIonInfiniteScrollElement).complete();
    }
  }

  function abrir(item: Notificacao) {
    toque();
    if (!lida(item) && dados) {
      setLidas({ base: dados, ids: new Set([...(marcadas?.ids ?? []), item.id]), todas: Boolean(marcadas?.todas) });
      void pedir(`/api/notificacoes/${item.id}/lida`, { method: "POST" }).catch(() => undefined);
    }
    navegar(rotaDoApp(item.destino));
  }

  async function lerTodas() {
    if (!dados) return;
    setLendoTodas(true);
    try {
      await enviar("/api/notificacoes/lidas", {});
      setLidas({ base: dados, ids: new Set(), todas: true });
      toque(true);
    } catch (error) {
      void avisar({ message: error instanceof Error ? error.message : "Não foi possível marcar como lidas.", duration: 2400, position: "top", cssClass: "aviso-de-erro" });
    } finally {
      setLendoTodas(false);
    }
  }

  return (
    <Pagina
      titulo="Notificações"
      etiqueta={dados ? (naoLidas === 0 ? "Tudo lido" : `${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}`) : undefined}
      semSino
      aoAtualizar={recarregar}
      fim={
        <IonButtons>
          <IonButton routerLink="/inicio" routerDirection="back" aria-label="Voltar">
            <IonIcon slot="icon-only" icon={chevronBack} />
          </IonButton>
          <IonButton aria-label="Marcar todas como lidas" disabled={naoLidas === 0 || lendoTodas} onClick={() => void lerTodas()}>
            <IonIcon slot="icon-only" icon={checkmarkDoneOutline} />
          </IonButton>
        </IonButtons>
      }
    >
      <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

      {dados ? (
        <Cascata className="pagina">
          {itens.length === 0 ? (
            <Bloco>
              <Vazio
                icone={notificationsOffOutline}
                titulo="Nada por aqui"
                texto="Vencimentos, lembretes, extratos, metas e planos do assistente aparecem nesta lista."
              />
            </Bloco>
          ) : (
            <Bloco className="lista">
              {itens.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  className={`linha-de-notificacao${lida(item) ? "" : " nao-lida"}`}
                  whileTap={{ backgroundColor: "var(--surface-2)" }}
                  onClick={() => abrir(item)}
                >
                  <span className="marca-de-nao-lida" aria-hidden />
                  <span className="texto">
                    <span className="topo">
                      <span>{item.titulo}</span>
                      <time className="etiqueta" dateTime={item.criadaEm}>
                        {quando(item.criadaEm)}
                      </time>
                    </span>
                    <span className="corpo">{item.texto}</span>
                    <span className="etiqueta">
                      {ROTULO_DO_TIPO_DE_NOTIFICACAO[item.tipo].titulo}
                      {lida(item) ? null : <span className="so-leitor-de-tela">, não lida</span>}
                    </span>
                  </span>
                </motion.button>
              ))}
            </Bloco>
          )}

          <Bloco>
            <motion.div whileTap={toqueDoDedo}>
              <IonButton expand="block" fill="outline" routerLink="/perfil?aba=avisos">
                <IonIcon slot="start" icon={settingsOutline} />
                Escolher o que receber
              </IonButton>
            </motion.div>
          </Bloco>
        </Cascata>
      ) : null}

      <IonInfiniteScroll disabled={!proxima} onIonInfinite={(evento) => void carregarMais(evento)}>
        <IonInfiniteScrollContent />
      </IonInfiniteScroll>
    </Pagina>
  );
}
