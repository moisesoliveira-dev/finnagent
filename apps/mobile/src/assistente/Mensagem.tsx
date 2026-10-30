import { IonButton, IonTextarea } from "@ionic/react";
import {
  APROVAR_PLANO,
  CANCELAR_PLANO,
  type MensagemDoChat,
  type ParteDaMensagem,
  type PerguntaDoAssistente,
  type PlanoDoAssistente,
} from "@finnagent/contracts";
import { motion } from "motion/react";
import { useState } from "react";
import { MESES_CURTOS, dataCurta, reais } from "../api/formato";
import { Dinheiro } from "../componentes/Estado";
import { toque } from "../haptico";
import { Bloco, Cascata, curvaCheia, toqueDoDedo } from "../movimento";

/** O plano do consultor: entendimento, suposições, passos e o que o sistema calculou. Nada muda antes de aprovar. */
function CartaoDePlano({
  pergunta,
  plano,
  ativa,
  aoResponder,
}: {
  pergunta: PerguntaDoAssistente;
  plano: PlanoDoAssistente;
  ativa: boolean;
  aoResponder: (escolha: string) => void;
}) {
  const [ajuste, setAjuste] = useState("");
  const aberta = pergunta.resposta === null;
  const aprovado = pergunta.resposta === APROVAR_PLANO;
  const cancelado = pergunta.resposta === CANCELAR_PLANO || pergunta.resposta === "Sem resposta";
  const fatos = new Map(plano.fatos.passos.map((fato) => [fato.passo, fato]));
  const { mes } = plano.fatos;
  const rotulo = aberta ? "Plano para você aprovar" : aprovado ? "Plano aprovado" : cancelado ? "Plano não executado" : "Plano ajustado";

  return (
    <motion.div className={`cartao${aberta ? " destaque" : ""}`} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={curvaCheia}>
      <div className="secao" style={{ gap: 4 }}>
        <span className="etiqueta" style={aberta ? { color: "var(--brand)" } : undefined}>
          {rotulo}
        </span>
        <strong>{plano.objetivo}</strong>
        <span className="fraco">{plano.entendimento}</span>
      </div>

      {plano.suposicoes.length ? (
        <div className="secao" style={{ gap: 4 }}>
          <span className="etiqueta">O que eu supus</span>
          {plano.suposicoes.map((item) => (
            <span key={item}>· {item}</span>
          ))}
        </div>
      ) : null}

      <Cascata className="secao">
        <span className="etiqueta">Passos</span>
        {plano.passos.map((passo, indice) => {
          const fato = fatos.get(indice + 1);
          return (
            <Bloco key={`${indice}-${passo.ferramenta}`} className="plano-passo">
              <span className={passo.destrutiva ? "neg" : undefined}>
                {indice + 1}. {passo.descricao}
              </span>
              {fato ? (
                <span className="fraco" style={{ fontSize: "0.75rem" }}>
                  <Dinheiro cents={fato.valorCents} />
                  {fato.recorrente ? " por mês" : ""} ·{" "}
                  {fato.datas
                    .map((item) =>
                      item.data === item.base
                        ? dataCurta(item.data)
                        : `${dataCurta(item.data)} (em vez de ${dataCurta(item.base)}${item.feriado ? `, ${item.feriado}` : ""})`,
                    )
                    .join(" · ")}
                </span>
              ) : null}
            </Bloco>
          );
        })}
      </Cascata>

      {mes || plano.fatos.alertas.length ? (
        <div className="secao" style={{ gap: 8 }}>
          {mes ? (
            <span>
              <span className="etiqueta">
                Sobra de {MESES_CURTOS[mes.mes - 1]}/{mes.ano}{" "}
              </span>
              {reais(mes.sobraAntesCents)} → <strong>{reais(mes.sobraDepoisCents)}</strong>
            </span>
          ) : null}
          {plano.fatos.alertas.map((alerta) => (
            <p key={alerta} className="aviso" style={{ margin: 0 }}>
              {alerta}
            </p>
          ))}
        </div>
      ) : null}

      {aberta && ativa ? (
        <div className="secao">
          <div style={{ display: "flex", gap: 8 }}>
            <motion.div whileTap={toqueDoDedo}>
              <IonButton
                className="principal"
                onClick={() => {
                  toque(true);
                  aoResponder(APROVAR_PLANO);
                }}
              >
                {APROVAR_PLANO}
              </IonButton>
            </motion.div>
            <motion.div whileTap={toqueDoDedo}>
              <IonButton fill="clear" onClick={() => aoResponder(CANCELAR_PLANO)}>
                {CANCELAR_PLANO}
              </IonButton>
            </motion.div>
          </div>
          <form
            className="compositor"
            style={{ padding: 0, border: 0, background: "transparent" }}
            onSubmit={(evento) => {
              evento.preventDefault();
              if (ajuste.trim()) aoResponder(ajuste.trim());
            }}
          >
            <IonTextarea
              rows={1}
              autoGrow
              value={ajuste}
              maxlength={300}
              placeholder="Quer mudar algo? Escreva o ajuste"
              aria-label="Pedir um ajuste no plano"
              onIonInput={(evento) => setAjuste(String(evento.detail.value ?? ""))}
            />
            <IonButton type="submit" fill="outline" disabled={!ajuste.trim()}>
              Ajustar
            </IonButton>
          </form>
        </div>
      ) : null}
      {!aberta && !aprovado && !cancelado ? <span className="fraco">Ajuste pedido: {pergunta.resposta}</span> : null}
    </motion.div>
  );
}

function Pergunta({ pergunta, ativa, aoResponder }: { pergunta: PerguntaDoAssistente; ativa: boolean; aoResponder: (escolha: string) => void }) {
  if (pergunta.tipo === "plano" && pergunta.plano) {
    return <CartaoDePlano pergunta={pergunta} plano={pergunta.plano} ativa={ativa} aoResponder={aoResponder} />;
  }
  return (
    <motion.div className="cartao" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={curvaCheia}>
      <strong>{pergunta.texto}</strong>
      {pergunta.resposta !== null ? <span className="fraco">Você respondeu: {pergunta.resposta}</span> : null}
      {pergunta.resposta === null && ativa
        ? pergunta.opcoes.map((opcao) => (
            <motion.button
              key={opcao.rotulo}
              type="button"
              className="plano-passo"
              style={{ textAlign: "left", background: "transparent", font: "inherit", color: "inherit" }}
              whileTap={toqueDoDedo}
              onClick={() => {
                toque();
                aoResponder(opcao.rotulo);
              }}
            >
              <span>{opcao.rotulo}</span>
              {opcao.descricao ? <span className="fraco">{opcao.descricao}</span> : null}
            </motion.button>
          ))
        : null}
    </motion.div>
  );
}

function Parte({ parte, ativa, aoResponder }: { parte: ParteDaMensagem; ativa: boolean; aoResponder: (escolha: string) => void }) {
  switch (parte.tipo) {
    case "texto":
      return parte.texto ? (
        <motion.div className="balao" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={curvaCheia} style={{ transformOrigin: "0% 100%" }}>
          {parte.texto}
        </motion.div>
      ) : null;
    case "acao":
      return (
        <motion.div className="acao" data-estado={parte.acao.estado} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={curvaCheia}>
          <span>{parte.acao.rotulo}</span>
          {parte.acao.detalhe ? <span className="fraco">· {parte.acao.detalhe}</span> : null}
        </motion.div>
      );
    case "pergunta":
      return <Pergunta pergunta={parte.pergunta} ativa={ativa} aoResponder={aoResponder} />;
    default:
      return null;
  }
}

export function MensagemDaConversa({
  mensagem,
  ativa,
  aoResponder,
}: {
  mensagem: MensagemDoChat;
  /** Só a última mensagem aceita resposta, e só com o assistente parado. */
  ativa: boolean;
  aoResponder: (escolha: string) => void;
}) {
  if (mensagem.role === "user") {
    const texto = mensagem.partes.map((parte) => (parte.tipo === "texto" ? parte.texto : "")).join("");
    return (
      <motion.div className="balao minha" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={curvaCheia} style={{ transformOrigin: "100% 100%" }}>
        {texto}
      </motion.div>
    );
  }
  return (
    <div className="mensagem">
      {mensagem.partes.map((parte, indice) => (
        <Parte key={indice} parte={parte} ativa={ativa} aoResponder={aoResponder} />
      ))}
    </div>
  );
}
