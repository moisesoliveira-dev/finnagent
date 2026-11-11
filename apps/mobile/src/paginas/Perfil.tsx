import { IonAlert, IonButton, IonButtons, IonIcon, useIonToast } from "@ionic/react";
import type { PerfilDoUsuario } from "@finnagent/contracts";
import { chevronBack, chevronForward, lockClosedOutline, logOutOutline, notificationsOutline, personOutline, phonePortraitOutline, settingsOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { enviar, pedir } from "../api/cliente";
import { desde } from "../api/formato";
import { atualizarUsuario, encerrarSessao } from "../api/sessao";
import { Avatar } from "../componentes/Avatar";
import { Estado } from "../componentes/Estado";
import { Folha } from "../componentes/Folha";
import { Pagina } from "../componentes/Pagina";
import { toque } from "../haptico";
import { Bloco, Cascata, mola, toqueDoDedo } from "../movimento";
import { desligarPushNoCelular } from "../notificacoes/push";
import { useDados } from "../useDados";
import { AbaAvisos } from "./perfil/AbaAvisos";
import { AbaPerfil, type DadosDoPerfil } from "./perfil/AbaPerfil";
import { AbaSeguranca } from "./perfil/AbaSeguranca";
import { AbaSessoes } from "./perfil/AbaSessoes";

type Aba = "perfil" | "avisos" | "seguranca" | "sessoes";
const ABAS: Aba[] = ["perfil", "avisos", "seguranca", "sessoes"];

// O que se mexe no perfil, em linhas como as de um aparelho: cada uma abre a sua folha.
const SECOES: Array<{ aba: Aba; icone: string; titulo: string; texto: string }> = [
  { aba: "perfil", icone: personOutline, titulo: "Dados do perfil", texto: "Nome, cargo, cidade e avatar" },
  { aba: "avisos", icone: notificationsOutline, titulo: "Avisos", texto: "Em que canal cada aviso chega" },
  { aba: "seguranca", icone: lockClosedOutline, titulo: "Segurança", texto: "A senha da conta" },
  { aba: "sessoes", icone: phonePortraitOutline, titulo: "Sessões", texto: "Onde você está conectado" },
];

const dadosDe = (perfil: PerfilDoUsuario): DadosDoPerfil => ({
  name: perfil.name,
  headline: perfil.headline,
  location: perfil.location,
  bio: perfil.bio,
  avatarTone: perfil.avatarTone,
});

export function Perfil() {
  const [avisar] = useIonToast();
  const { dados, erro, carregando, recarregar } = useDados<PerfilDoUsuario>("/api/perfil");
  const [perfil, setPerfil] = useState<PerfilDoUsuario | null>(null);
  const [rascunho, setRascunho] = useState<DadosDoPerfil | null>(null);
  // A lista de notificações abre o perfil direto na aba dos avisos.
  const { search } = useLocation();
  const pedida = new URLSearchParams(search).get("aba");
  const [aberta, setAberta] = useState<Aba | null>(ABAS.includes(pedida as Aba) ? (pedida as Aba) : null);
  // O Ionic mantém a tela montada: um link novo com `?aba=` abre a folha pedida.
  useEffect(() => {
    if (pedida && ABAS.includes(pedida as Aba)) setAberta(pedida as Aba);
  }, [pedida]);
  const [salvando, setSalvando] = useState(false);
  const [erroAoSalvar, setErroAoSalvar] = useState("");
  const [saindo, setSaindo] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  // O que o servidor mandou vira o perfil salvo e o rascunho de quem edita.
  useEffect(() => {
    if (!dados) return;
    setPerfil(dados);
    setRascunho(dadosDe(dados));
  }, [dados]);

  const original = perfil ? dadosDe(perfil) : null;
  const alterado = Boolean(rascunho && original && (Object.keys(original) as (keyof DadosDoPerfil)[]).some((campo) => rascunho[campo] !== original[campo]));
  const somenteLeitura = Boolean(perfil?.semLogin);

  async function salvar() {
    if (!rascunho || salvando) return;
    setErroAoSalvar("");
    setSalvando(true);
    try {
      const salvo = await enviar<PerfilDoUsuario>("/api/perfil", rascunho, "PATCH");
      setPerfil(salvo);
      setRascunho(dadosDe(salvo));
      await atualizarUsuario({ id: salvo.id, name: salvo.name, email: salvo.email, role: salvo.role });
      toque(true);
      void avisar({ message: "Perfil salvo.", duration: 2200, position: "top" });
    } catch (error) {
      setErroAoSalvar(error instanceof Error ? error.message : "Não foi possível salvar o perfil.");
      toque(true);
    } finally {
      setSalvando(false);
    }
  }

  async function sair() {
    setSaindo(true);
    // Este celular deixa de receber o push de quem saiu.
    await desligarPushNoCelular().catch(() => undefined);
    // Revoga no servidor; se ele não responder, a sessão sai do aparelho do mesmo jeito.
    await pedir<void>("/api/auth/sair", { method: "POST" }).catch(() => undefined);
    await encerrarSessao();
  }

  return (
    <Pagina
      titulo="Perfil"
      etiqueta="Do jeito que você aparece na conta"
      semPerfil
      aoAtualizar={recarregar}
      fim={
        <IonButtons>
          <IonButton routerLink="/configuracoes" aria-label="Configurações">
            <IonIcon slot="icon-only" icon={settingsOutline} />
          </IonButton>
          <IonButton routerLink="/inicio" routerDirection="back" aria-label="Voltar">
            <IonIcon slot="icon-only" icon={chevronBack} />
          </IonButton>
        </IonButtons>
      }
    >
      <Estado carregando={carregando} erro={erro} tem={Boolean(perfil)} aoTentar={() => void recarregar()} />

      {perfil && rascunho ? (
        <Cascata className="pagina">
          {/* O cartão mostra o rascunho: o que a pessoa digita aparece nele na hora, antes de salvar. */}
          <Bloco className="cartao-do-perfil">
            <div className="faixa-de-pontos pontos" />
            <div className="corpo-do-cartao">
              <motion.span key={rascunho.avatarTone} className="avatar-do-cartao" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={mola}>
                <Avatar nome={rascunho.name} tom={rascunho.avatarTone} tamanho={84} />
              </motion.span>
              <div className="secao" style={{ gap: 4 }}>
                <h2 className="titulo" style={{ fontSize: "1.5rem", wordBreak: "break-word" }}>
                  {rascunho.name.trim() || "Seu nome"}
                </h2>
                <span className="fraco" style={{ wordBreak: "break-word" }}>
                  {rascunho.headline.trim() || "Seu cargo ou ocupação"}
                </span>
              </div>
              <div className="chips">
                <span className={`chip${perfil.role === "master" ? " ok" : ""}`}>{perfil.role === "master" ? "Master" : "Membro"}</span>
                {perfil.createdAt ? <span className="chip">Desde {desde(perfil.createdAt)}</span> : null}
                {alterado ? <span className="chip ia">Não salvo</span> : null}
              </div>
            </div>
          </Bloco>

          <Bloco className="secao">
            <div className="lista">
              {SECOES.map((secao) => (
                <button key={secao.aba} type="button" className="linha linha-botao atalho-de-linha" onClick={() => (toque(), setAberta(secao.aba))}>
                  <IonIcon icon={secao.icone} aria-hidden />
                  <span className="texto" style={{ flex: 1 }}>
                    <strong>{secao.titulo}</strong>
                    <span className="etiqueta">{secao.texto}</span>
                  </span>
                  {secao.aba === "perfil" && alterado ? <span className="chip ia">Não salvo</span> : null}
                  <IonIcon icon={chevronForward} aria-hidden />
                </button>
              ))}
            </div>
          </Bloco>

          <Bloco>
            <motion.div whileTap={toqueDoDedo}>
              <IonButton expand="block" fill="outline" color="danger" disabled={saindo} onClick={() => setConfirmandoSaida(true)}>
                <IonIcon slot="start" icon={logOutOutline} />
                {saindo ? "Saindo" : "Sair da conta"}
              </IonButton>
            </motion.div>
          </Bloco>
        </Cascata>
      ) : null}

      <Folha aberta={aberta !== null} titulo={SECOES.find((secao) => secao.aba === aberta)?.titulo ?? ""} aoFechar={() => setAberta(null)}>
        {perfil && rascunho && aberta === "perfil" ? (
          <AbaPerfil
            rascunho={rascunho}
            email={perfil.email}
            somenteLeitura={somenteLeitura}
            alterado={alterado}
            salvando={salvando}
            erro={erroAoSalvar}
            aoMudar={(parcial) => setRascunho((atual) => (atual ? { ...atual, ...parcial } : atual))}
            aoSalvar={() => void salvar()}
            aoDescartar={() => {
              setRascunho(dadosDe(perfil));
              setErroAoSalvar("");
            }}
          />
        ) : null}
        {aberta === "avisos" ? <AbaAvisos somenteLeitura={somenteLeitura} /> : null}
        {aberta === "seguranca" ? <AbaSeguranca somenteLeitura={somenteLeitura} /> : null}
        {aberta === "sessoes" ? <AbaSessoes somenteLeitura={somenteLeitura} /> : null}
      </Folha>

      <IonAlert
        isOpen={confirmandoSaida}
        header="Sair da conta?"
        message="Você precisará entrar de novo neste aparelho."
        buttons={[
          { text: "Cancelar", role: "cancel" },
          { text: "Sair", role: "destructive", handler: () => void sair() },
        ]}
        onDidDismiss={() => setConfirmandoSaida(false)}
      />
    </Pagina>
  );
}
