import { IonAlert, IonButton, IonIcon, useIonToast } from "@ionic/react";
import type { SessoesDoUsuario } from "@finnagent/contracts";
import { phonePortraitOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { useState } from "react";
import { enviar } from "../../api/cliente";
import { dataEHora } from "../../api/formato";
import { Estado, Vazio } from "../../componentes/Estado";
import { toque } from "../../haptico";
import { Bloco, Cascata, toqueDoDedo } from "../../movimento";
import { useDados } from "../../useDados";

export function AbaSessoes({ somenteLeitura }: { somenteLeitura: boolean }) {
  const [avisar] = useIonToast();
  const { dados, erro, carregando, recarregar } = useDados<SessoesDoUsuario>("/api/perfil/sessoes");
  const [confirmando, setConfirmando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const outras = dados ? dados.sessions.filter((sessao) => !sessao.current).length : 0;

  async function encerrarOutras() {
    setEncerrando(true);
    try {
      const resposta = await enviar<{ sessoesEncerradas: number }>("/api/perfil/sessoes/encerrar-outras", {});
      await recarregar();
      toque(true);
      void avisar({
        message: resposta.sessoesEncerradas === 1 ? "1 sessão encerrada." : `${resposta.sessoesEncerradas} sessões encerradas.`,
        duration: 2800,
        position: "top",
      });
    } catch (error) {
      void avisar({ message: error instanceof Error ? error.message : "Não foi possível encerrar as sessões.", duration: 3200, cssClass: "aviso-de-erro", position: "top" });
    } finally {
      setEncerrando(false);
    }
  }

  return (
    <div className="secao" style={{ gap: 16 }}>
      <div className="secao" style={{ gap: 4 }}>
        <h2 className="titulo-da-folha">Onde você entrou</h2>
        <span className="fraco">Cada linha é um aparelho com a sessão aberta. Se não reconhecer um deles, encerre as outras e troque a senha.</span>
      </div>

      <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

      {dados && dados.sessions.length === 0 ? <Vazio icone={phonePortraitOutline} titulo="Nenhuma sessão aberta" texto="Quando você entrar em um aparelho, ele aparece aqui." /> : null}

      {dados && dados.sessions.length > 0 ? (
        <Cascata className="lista">
          {dados.sessions.map((sessao) => (
            <Bloco key={sessao.ref} className="linha sessao">
              <IonIcon icon={phonePortraitOutline} aria-hidden />
              <div className="texto" style={{ flex: 1 }}>
                <span>{sessao.device}</span>
                <span className="etiqueta">Entrou em {dataEHora(sessao.createdAt)}</span>
              </div>
              {sessao.current ? <span className="etiqueta marca-ok">Este aparelho</span> : null}
            </Bloco>
          ))}
        </Cascata>
      ) : null}

      <motion.div whileTap={toqueDoDedo}>
        <IonButton expand="block" fill="outline" color="danger" disabled={somenteLeitura || outras === 0 || encerrando} onClick={() => setConfirmando(true)}>
          {encerrando ? "Encerrando" : "Encerrar as outras"}
        </IonButton>
      </motion.div>

      <IonAlert
        isOpen={confirmando}
        header="Encerrar as outras sessões?"
        message="Os outros aparelhos precisarão entrar de novo. Este continua aberto."
        buttons={[
          { text: "Cancelar", role: "cancel" },
          { text: "Encerrar", role: "destructive", handler: () => void encerrarOutras() },
        ]}
        onDidDismiss={() => setConfirmando(false)}
      />
    </div>
  );
}
