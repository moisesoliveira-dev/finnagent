import { IonButton, useIonToast } from "@ionic/react";
import { SENHA_MINIMA } from "@finnagent/contracts";
import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { enviar } from "../../api/cliente";
import { CampoDeSenha } from "../../componentes/Campo";
import { MedidorDeForca } from "../../componentes/MedidorDeForca";
import { toque } from "../../haptico";
import { toqueDoDedo } from "../../movimento";

export function AbaSeguranca({ somenteLeitura }: { somenteLeitura: boolean }) {
  const [avisar] = useIonToast();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const diverge = confirma !== "" && confirma !== nova;

  async function trocar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando || somenteLeitura) return;
    if (!atual) return setErro("Informe a senha atual.");
    if (nova.length < SENHA_MINIMA) return setErro(`A nova senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`);
    if (nova !== confirma) return setErro("As senhas novas não são iguais.");
    setErro("");
    setEnviando(true);
    try {
      const resposta = await enviar<{ sessoesEncerradas: number }>("/api/perfil/senha", { currentPassword: atual, newPassword: nova });
      setAtual("");
      setNova("");
      setConfirma("");
      toque(true);
      const outras = resposta.sessoesEncerradas;
      void avisar({
        message: outras > 0 ? `Senha trocada. ${outras === 1 ? "1 outra sessão foi encerrada" : `${outras} outras sessões foram encerradas`}.` : "Senha trocada.",
        duration: 3200,
        position: "top",
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível trocar a senha.");
      toque(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form noValidate className="secao" style={{ gap: 16 }} onSubmit={(evento) => void trocar(evento)}>
      <div className="secao" style={{ gap: 4 }}>
        <h2 className="titulo-da-folha">Trocar a senha</h2>
        <span className="fraco">Ao trocar, as sessões abertas em outros aparelhos são encerradas. Esta continua aberta.</span>
      </div>

      <CampoDeSenha rotulo="Senha atual" autoComplete="current-password" value={atual} onMudar={setAtual} />
      <CampoDeSenha rotulo="Nova senha" autoComplete="new-password" value={nova} onMudar={setNova} />
      <MedidorDeForca senha={nova} />
      <CampoDeSenha rotulo="Repita a nova senha" autoComplete="new-password" value={confirma} onMudar={setConfirma} />

      <AnimatePresence initial={false}>
        {diverge ? (
          <motion.p key="diverge" className="aviso" role="status" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            As senhas ainda não são iguais.
          </motion.p>
        ) : null}
        {erro ? (
          <motion.p key={erro} className="erro" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            {erro}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <motion.div whileTap={toqueDoDedo}>
        <IonButton type="submit" expand="block" className="principal" disabled={somenteLeitura || enviando || !atual || !nova || !confirma}>
          {enviando ? "Trocando" : "Trocar a senha"}
        </IonButton>
      </motion.div>
    </form>
  );
}
