import { IonButton, IonToggle, useIonToast } from "@ionic/react";
import {
  CANAIS_DE_NOTIFICACAO,
  ROTULO_DO_CANAL_DE_NOTIFICACAO,
  ROTULO_DO_TIPO_DE_NOTIFICACAO,
  TIPOS_DE_NOTIFICACAO,
  type CanaisDisponiveis,
  type CanalDeNotificacao,
  type PreferenciasDeNotificacao,
  type TipoDeNotificacao,
} from "@finnagent/contracts";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { enviar } from "../../api/cliente";
import { Estado } from "../../componentes/Estado";
import { Hora } from "../../componentes/Hora";
import { toque } from "../../haptico";
import { curvaCheia, toqueDoDedo } from "../../movimento";
import {
  desligarPushNoCelular,
  estadoDoPushNoCelular,
  ligarPushNoCelular,
  type EstadoDoPushNoCelular,
} from "../../notificacoes/push";
import { useDados } from "../../useDados";

const DICA_DO_CELULAR: Record<EstadoDoPushNoCelular, string> = {
  ligado: "Este celular recebe o push, mesmo com o app fechado.",
  desligado: "Ative para receber o push neste celular, mesmo com o app fechado.",
  bloqueado: "O celular bloqueou as notificações do Prumo. Libere nos ajustes do aparelho e volte aqui.",
  indisponivel: "O push só chega no app instalado. No navegador, a lista de notificações continua valendo.",
};

/** O que esta pessoa quer receber, por tipo e por canal, e o horário de silêncio. Salva a cada toque. */
export function AbaAvisos({ somenteLeitura }: { somenteLeitura: boolean }) {
  const [avisar] = useIonToast();
  const { dados, erro, carregando, recarregar } = useDados<PreferenciasDeNotificacao>("/api/notificacoes/preferencias");
  const disponiveis = useDados<CanaisDisponiveis>("/api/notificacoes/canais");
  const [editadas, setEditadas] = useState<{ base: PreferenciasDeNotificacao; atual: PreferenciasDeNotificacao } | null>(null);
  const [celular, setCelular] = useState<EstadoDoPushNoCelular>("indisponivel");
  const [ligando, setLigando] = useState(false);
  const [situacao, setSituacao] = useState<"" | "salvando" | "salvo">("");
  const pedido = useRef(0);

  useEffect(() => {
    void estadoDoPushNoCelular().then(setCelular);
  }, []);

  const preferencias = editadas && editadas.base === dados ? editadas.atual : dados;

  async function salvar(proximas: PreferenciasDeNotificacao) {
    if (!dados || !preferencias) return;
    const anteriores = preferencias;
    const atual = ++pedido.current;
    toque();
    setEditadas({ base: dados, atual: proximas });
    setSituacao("salvando");
    try {
      await enviar("/api/notificacoes/preferencias", proximas, "PUT");
      if (atual === pedido.current) setSituacao("salvo");
    } catch (error) {
      if (atual !== pedido.current) return;
      setEditadas({ base: dados, atual: anteriores });
      setSituacao("");
      void avisar({ message: error instanceof Error ? error.message : "Não foi possível salvar.", duration: 3000, position: "top", cssClass: "aviso-de-erro" });
    }
  }

  function mudarCanal(tipo: TipoDeNotificacao, canal: CanalDeNotificacao) {
    if (!preferencias) return;
    const valor = !preferencias.canais[tipo][canal];
    void salvar({ ...preferencias, canais: { ...preferencias.canais, [tipo]: { ...preferencias.canais[tipo], [canal]: valor } } });
  }

  async function alternarCelular() {
    setLigando(true);
    try {
      if (celular === "ligado") {
        await desligarPushNoCelular();
        setCelular("desligado");
      } else {
        const estado = await ligarPushNoCelular();
        setCelular(estado);
        if (estado === "ligado") {
          toque(true);
          void avisar({ message: "Push ativado neste celular.", duration: 2400, position: "top" });
        }
      }
    } catch (error) {
      void avisar({ message: error instanceof Error ? error.message : "Não foi possível ativar o push.", duration: 3200, position: "top", cssClass: "aviso-de-erro" });
    } finally {
      setLigando(false);
    }
  }

  const semServidor = disponiveis.dados && !disponiveis.dados.celular;

  return (
    <div className="secao" style={{ gap: 16 }}>
      <div className="secao" style={{ gap: 4 }}>
        <h2 className="titulo-da-folha">O que você recebe</h2>
        <span className="fraco">Estas escolhas são suas. Cada pessoa da conta tem as próprias.</span>
        <AnimatePresence mode="wait" initial={false}>
          {situacao ? (
            <motion.span key={situacao} role="status" className="etiqueta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={curvaCheia}>
              {situacao === "salvando" ? "Salvando" : "Salvo"}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="secao" style={{ gap: 8 }}>
        <span className="etiqueta">Este celular</span>
        <span className="fraco">{semServidor && celular !== "indisponivel" ? "O servidor ainda não tem o push do celular configurado." : DICA_DO_CELULAR[celular]}</span>
        {celular === "ligado" || celular === "desligado" ? (
          <motion.div whileTap={toqueDoDedo}>
            <IonButton expand="block" fill={celular === "ligado" ? "outline" : "solid"} disabled={ligando || somenteLeitura || Boolean(semServidor)} onClick={() => void alternarCelular()}>
              {ligando ? (celular === "ligado" ? "Desativando" : "Ativando") : celular === "ligado" ? "Desativar neste celular" : "Ativar neste celular"}
            </IonButton>
          </motion.div>
        ) : null}
      </div>

      <Estado carregando={carregando} erro={erro} tem={Boolean(preferencias)} aoTentar={() => void recarregar()} />

      {preferencias ? (
        <>
          <div className="secao" style={{ gap: 0 }}>
            {TIPOS_DE_NOTIFICACAO.map((tipo) => {
              const rotulo = ROTULO_DO_TIPO_DE_NOTIFICACAO[tipo];
              const central = preferencias.canais[tipo].central;
              return (
                <div key={tipo} className="aviso-por-canal">
                  <div className="secao" style={{ gap: 4 }}>
                    <strong>{rotulo.titulo}</strong>
                    <span className="fraco">{rotulo.dica}</span>
                  </div>
                  <div className="canais-do-aviso" role="group" aria-label={`Onde receber: ${rotulo.titulo}`}>
                    {CANAIS_DE_NOTIFICACAO.map((canal) => {
                      const ligado = preferencias.canais[tipo][canal] && (canal === "central" || central);
                      return (
                        <motion.button
                          key={canal}
                          type="button"
                          aria-pressed={ligado}
                          disabled={somenteLeitura || (canal !== "central" && !central)}
                          className={`ficha${ligado ? " ativa" : ""}`}
                          whileTap={toqueDoDedo}
                          onClick={() => mudarCanal(tipo, canal)}
                        >
                          {ROTULO_DO_CANAL_DE_NOTIFICACAO[canal]}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <span className="fraco" style={{ fontSize: "0.875rem" }}>
              Desligar &quot;No sistema&quot; desliga o aviso todo: o push só sai do que entra na lista.
            </span>
          </div>

          <div className="secao" style={{ gap: 8 }}>
            <IonToggle
              checked={preferencias.silencio.ativo}
              disabled={somenteLeitura}
              labelPlacement="start"
              justify="space-between"
              onIonChange={(evento) => void salvar({ ...preferencias, silencio: { ...preferencias.silencio, ativo: evento.detail.checked } })}
            >
              <strong>Horário de silêncio</strong>
            </IonToggle>
            <span className="fraco">O push não toca nesse intervalo, no fuso da conta. Os avisos continuam chegando na lista.</span>
            <div className="horario-de-silencio">
              <Hora
                rotulo="Início do silêncio"
                valor={preferencias.silencio.inicio}
                desabilitado={somenteLeitura || !preferencias.silencio.ativo}
                aoMudar={(inicio) => void salvar({ ...preferencias, silencio: { ...preferencias.silencio, inicio } })}
              />
              <span className="fraco">até</span>
              <Hora
                rotulo="Fim do silêncio"
                valor={preferencias.silencio.fim}
                desabilitado={somenteLeitura || !preferencias.silencio.ativo}
                aoMudar={(fim) => void salvar({ ...preferencias, silencio: { ...preferencias.silencio, fim } })}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
