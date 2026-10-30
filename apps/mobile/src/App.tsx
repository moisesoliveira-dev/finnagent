import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { App as AppNativo } from "@capacitor/app";
import { calendarOutline, chatbubbleEllipsesOutline, flagOutline, homeOutline, walletOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Navigate, Route, useLocation, useNavigate } from "react-router-dom";
import { aoMudarASessao, carregarSessao, sessaoAtual } from "./api/sessao";
import { Simbolo } from "./componentes/Simbolo";
import { toque } from "./haptico";
import { Movimento, curvaSaida, mola } from "./movimento";
import { Agenda } from "./paginas/Agenda";
import { Assistente } from "./paginas/Assistente";
import { Financas } from "./paginas/Financas";
import { Inicio } from "./paginas/Inicio";
import { Login } from "./paginas/Login";
import { Metas } from "./paginas/Metas";
import { Extratos } from "./paginas/Extratos";
import { Notificacoes } from "./paginas/Notificacoes";
import { Perfil } from "./paginas/Perfil";
import { recontar } from "./notificacoes/contagem";
import { ouvirPush } from "./notificacoes/push";

type Estado = "carregando" | "entrou" | "saiu";

const ABAS = [
  { tab: "inicio", rotulo: "Início", icone: homeOutline },
  { tab: "financas", rotulo: "Finanças", icone: walletOutline },
  { tab: "assistente", rotulo: "Assistente", icone: chatbubbleEllipsesOutline },
  { tab: "agenda", rotulo: "Agenda", icone: calendarOutline },
  { tab: "metas", rotulo: "Metas", icone: flagOutline },
];

/** A barra de abas: a linha da aba atual desliza de uma para a outra, como a barra do menu no web. */
function BarraDeAbas() {
  const { pathname } = useLocation();
  return (
    <IonTabBar slot="bottom">
      {ABAS.map((aba) => {
        const ativa = pathname.startsWith(`/${aba.tab}`);
        return (
          <IonTabButton key={aba.tab} tab={aba.tab} href={`/${aba.tab}`}>
            {ativa ? <motion.span layoutId="aba" className="indicador" transition={mola} /> : null}
            <motion.span style={{ display: "inline-flex" }} animate={{ scale: ativa ? 1.12 : 1, y: ativa ? -1 : 0 }} transition={mola}>
              <IonIcon icon={aba.icone} />
            </motion.span>
            <IonLabel>{aba.rotulo}</IonLabel>
          </IonTabButton>
        );
      })}
    </IonTabBar>
  );
}

const A_CADA_MS = 60_000;

/**
 * Enquanto a pessoa está no app: conta as não lidas (ao abrir, ao voltar do fundo e a cada minuto), escuta o push
 * e leva para a tela da notificação tocada.
 */
function AvisosDoApp() {
  const navegar = useNavigate();

  useEffect(() => {
    void recontar();
    const relogio = setInterval(() => {
      if (document.visibilityState === "visible") void recontar();
    }, A_CADA_MS);
    const voltou = AppNativo.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void recontar();
    });
    const pararPush = ouvirPush(
      (rota) => navegar(rota),
      () => void recontar(),
    );
    return () => {
      clearInterval(relogio);
      void voltou.then((item) => item.remove());
      pararPush();
    };
  }, [navegar]);

  return null;
}

export function App() {
  const [estado, setEstado] = useState<Estado>("carregando");

  useEffect(() => {
    void carregarSessao().then((sessao) => setEstado(sessao ? "entrou" : "saiu"));
    // Sessão guardada, expirada ou revogada (401): a tela volta para o login.
    return aoMudarASessao(() => setEstado(sessaoAtual() ? "entrou" : "saiu"));
  }, []);

  // O botão voltar do Android fecha o app só na tela inicial.
  useEffect(() => {
    const ouvinte = AppNativo.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void AppNativo.exitApp();
    });
    return () => void ouvinte.then((item) => item.remove());
  }, []);

  return (
    <Movimento>
      <IonApp>
        <AnimatePresence mode="wait" initial={false}>
          {estado === "carregando" ? (
            <motion.div key="carregando" className="tela-cheia centro" exit={{ opacity: 0, transition: curvaSaida }}>
              {/* A logo respira enquanto a sessão é lida do cofre. */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: [1, 1.08, 1] }}
                transition={{ opacity: { duration: 0.3 }, scale: { repeat: Infinity, duration: 1.6, ease: "easeInOut" } }}
              >
                <Simbolo altura={80} />
              </motion.div>
            </motion.div>
          ) : estado === "saiu" ? (
            <motion.div key="login" className="tela-cheia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98, transition: curvaSaida }}>
              <Login />
            </motion.div>
          ) : (
            <motion.div key="app" className="tela-cheia" initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: curvaSaida }}>
              <IonReactRouter>
                <IonTabs onIonTabsDidChange={() => toque()}>
                  <IonRouterOutlet>
                    <Route path="/" element={<Navigate to="/inicio" replace />} />
                    <Route path="/inicio" element={<Inicio />} />
                    <Route path="/financas" element={<Financas />} />
                    <Route path="/agenda" element={<Agenda />} />
                    <Route path="/assistente" element={<Assistente />} />
                    <Route path="/metas" element={<Metas />} />
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/extratos" element={<Extratos />} />
                    <Route path="/notificacoes" element={<Notificacoes />} />
                  </IonRouterOutlet>
                  <BarraDeAbas />
                </IonTabs>
                <AvisosDoApp />
              </IonReactRouter>
            </motion.div>
          )}
        </AnimatePresence>
      </IonApp>
    </Movimento>
  );
}
