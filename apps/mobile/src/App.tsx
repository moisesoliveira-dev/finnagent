import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { App as AppNativo } from "@capacitor/app";
import { calendarOutline, chatbubbleEllipsesOutline, documentTextOutline, ellipsisHorizontal, homeOutline, walletOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, useLocation, useNavigate } from "react-router-dom";
import { aoMudarASessao, carregarSessao, sessaoAtual } from "./api/sessao";
import { Simbolo } from "./componentes/Simbolo";
import { toque } from "./haptico";
import { Movimento, curvaSaida, mola } from "./movimento";
import { rotaInterna } from "./navegacao";
import { Login } from "./paginas/Login";
import { recontar } from "./notificacoes/contagem";
import { ouvirPush } from "./notificacoes/push";
import { TemaDaConta } from "./tema/TemaDaConta";

const Agenda = lazy(() => import("./paginas/Agenda").then(({ Agenda }) => ({ default: Agenda })));
const Assistente = lazy(() => import("./paginas/Assistente").then(({ Assistente }) => ({ default: Assistente })));
const Contas = lazy(() => import("./paginas/Contas").then(({ Contas }) => ({ default: Contas })));
const DetalheDaConta = lazy(() => import("./paginas/contas/DetalheDaConta").then(({ DetalheDaConta }) => ({ default: DetalheDaConta })));
const Financas = lazy(() => import("./paginas/Financas").then(({ Financas }) => ({ default: Financas })));
const Configuracoes = lazy(() => import("./paginas/Configuracoes").then(({ Configuracoes }) => ({ default: Configuracoes })));
const ConfiguracaoDeIa = lazy(() => import("./paginas/configuracoes/ConfiguracaoDeIa").then(({ ConfiguracaoDeIa }) => ({ default: ConfiguracaoDeIa })));
const Eventos = lazy(() => import("./paginas/Eventos").then(({ Eventos }) => ({ default: Eventos })));
const Grupos = lazy(() => import("./paginas/Grupos").then(({ Grupos }) => ({ default: Grupos })));
const Relatorios = lazy(() => import("./paginas/Relatorios").then(({ Relatorios }) => ({ default: Relatorios })));
const Hoje = lazy(() => import("./paginas/Hoje").then(({ Hoje }) => ({ default: Hoje })));
const Inicio = lazy(() => import("./paginas/Inicio").then(({ Inicio }) => ({ default: Inicio })));
const Mais = lazy(() => import("./paginas/Mais").then(({ Mais }) => ({ default: Mais })));
const Metas = lazy(() => import("./paginas/Metas").then(({ Metas }) => ({ default: Metas })));
const Extratos = lazy(() => import("./paginas/Extratos").then(({ Extratos }) => ({ default: Extratos })));
const Notificacoes = lazy(() => import("./paginas/Notificacoes").then(({ Notificacoes }) => ({ default: Notificacoes })));
const Perfil = lazy(() => import("./paginas/Perfil").then(({ Perfil }) => ({ default: Perfil })));

function Pagina({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="tela-cheia centro">Carregando…</div>}>{children}</Suspense>;
}

type Estado = "carregando" | "entrou" | "saiu";

const ABAS = [
  { tab: "inicio", rotulo: "Início", icone: homeOutline },
  { tab: "financas", rotulo: "Finanças", icone: walletOutline },
  { tab: "extratos", rotulo: "Extratos", icone: documentTextOutline },
  { tab: "assistente", rotulo: "Assistente", icone: chatbubbleEllipsesOutline },
  { tab: "agenda", rotulo: "Agenda", icone: calendarOutline },
  { tab: "mais", rotulo: "Mais", icone: ellipsisHorizontal },
];

/** As abas que têm tela própria. O resto (Metas, Configurações...) se abre pelo "Mais" e conta como ele. */
const ABAS_PROPRIAS = ["inicio", "financas", "extratos", "assistente", "agenda"];

/** A barra de abas: a linha da aba atual desliza de uma para a outra, como a barra do menu no web. */
function BarraDeAbas() {
  const { pathname } = useLocation();
  return (
    <IonTabBar slot="bottom">
      {ABAS.map((aba) => {
        const ativa = aba.tab === "mais" ? !ABAS_PROPRIAS.some((tab) => pathname.startsWith(`/${tab}`)) : pathname.startsWith(`/${aba.tab}`);
        return (
          <IonTabButton key={aba.tab} tab={aba.tab} href={`/${aba.tab}`} className={ativa ? "ativa" : undefined}>
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
      (rota) => navegar(rotaInterna(rota)),
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
                    <Route path="/inicio" element={<Pagina><Inicio /></Pagina>} />
                    <Route path="/inicio/hoje" element={<Pagina><Hoje /></Pagina>} />
                    <Route path="/financas" element={<Pagina><Financas /></Pagina>} />
                    <Route path="/financas/contas" element={<Pagina><Contas /></Pagina>} />
                    <Route path="/financas/contas/:id" element={<Pagina><DetalheDaConta /></Pagina>} />
                    <Route path="/financas/grupos" element={<Pagina><Grupos /></Pagina>} />
                    <Route path="/financas/relatorios" element={<Pagina><Relatorios /></Pagina>} />
                    <Route path="/agenda" element={<Pagina><Agenda /></Pagina>} />
                    <Route path="/assistente" element={<Pagina><Assistente /></Pagina>} />
                    <Route path="/mais" element={<Pagina><Mais /></Pagina>} />
                    <Route path="/metas" element={<Pagina><Metas /></Pagina>} />
                    <Route path="/perfil" element={<Pagina><Perfil /></Pagina>} />
                    <Route path="/configuracoes" element={<Pagina><Configuracoes /></Pagina>} />
                    <Route path="/configuracoes/ia" element={<Pagina><ConfiguracaoDeIa /></Pagina>} />
                    <Route path="/configuracoes/eventos" element={<Pagina><Eventos /></Pagina>} />
                    <Route path="/extratos" element={<Pagina><Extratos /></Pagina>} />
                    <Route path="/notificacoes" element={<Pagina><Notificacoes /></Pagina>} />
                  </IonRouterOutlet>
                  <BarraDeAbas />
                </IonTabs>
                <AvisosDoApp />
                <TemaDaConta />
              </IonReactRouter>
            </motion.div>
          )}
        </AnimatePresence>
      </IonApp>
    </Movimento>
  );
}
