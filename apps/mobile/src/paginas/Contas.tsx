import { IonButton, IonButtons, IonIcon, useIonViewWillEnter } from "@ionic/react";
import { ROTULO_DO_TIPO_DE_CONTA, patrimonio, resumoDaCaixinha, resumoDaConta, type ContasResposta, type FinancasVista } from "@finnagent/contracts";
import { addOutline, chevronBack, chevronForward, walletOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { reais } from "../api/formato";
import { NovaConta } from "./contas/NovaConta";
import { Dinheiro, Estado, Vazio } from "../componentes/Estado";
import { Pagina } from "../componentes/Pagina";
import { Bloco, Cascata } from "../movimento";
import { useDados } from "../useDados";
import { hojeIso } from "./contas/movimentos";

const LinhaComMovimento = motion.create(Link);

/** O patrimônio, as contas e os cartões com o saldo de cada um, e as caixinhas de cada conta. Tocar abre o detalhe. */
export function Contas() {
  const contas = useDados<ContasResposta>("/api/contas");
  const financas = useDados<FinancasVista>("/api/financas");
  const hoje = hojeIso();
  const [criando, setCriando] = useState(false);

  const recarregar = () => Promise.all([contas.recarregar(), financas.recarregar()]).then(() => undefined);
  useIonViewWillEnter(() => {
    if (contas.dados) void recarregar();
  });

  const tem = Boolean(contas.dados && financas.dados);

  return (
    <Pagina
      titulo="Contas"
      etiqueta="Saldo de cada conta e fatura de cada cartão"
      semPerfil
      aoAtualizar={recarregar}
      fim={
        <IonButtons>
          <IonButton aria-label="Nova conta" onClick={() => setCriando(true)}>
            <IonIcon slot="icon-only" icon={addOutline} />
          </IonButton>
          <IonButton routerLink="/financas" routerDirection="back" aria-label="Voltar">
            <IonIcon slot="icon-only" icon={chevronBack} />
          </IonButton>
        </IonButtons>
      }
    >
      <Estado carregando={contas.carregando || financas.carregando} erro={contas.erro || financas.erro} tem={tem} aoTentar={() => void recarregar()} />

      {contas.dados && financas.dados ? (
        <Cascata className="pagina">
          {contas.dados.accounts.length === 0 ? (
            <Bloco>
              <Vazio icone={walletOutline} titulo="Nenhuma conta ainda" texto="Cadastre a conta do banco com o saldo de hoje. Só o que acontecer daqui para frente conta no saldo.">
                <IonButton onClick={() => setCriando(true)}>Cadastrar a conta</IonButton>
              </Vazio>
            </Bloco>
          ) : (
            <>
              {(() => {
                const total = patrimonio(contas.dados.accounts, contas.dados.boxes ?? [], financas.dados.entries, hoje);
                return (
                  <Bloco className="cartao destaque">
                    <span className="etiqueta">Patrimônio hoje</span>
                    <span className="numero grande">
                      <Dinheiro cents={total.totalCents} animado />
                    </span>
                    <div className="grade separada">
                      <div className="secao" style={{ gap: 4 }}>
                        <span className="etiqueta">Nas contas</span>
                        <Dinheiro cents={total.contasCents} />
                      </div>
                      {total.caixinhasCents !== 0 || (contas.dados.boxes ?? []).length > 0 ? (
                        <div className="secao" style={{ gap: 4 }}>
                          <span className="etiqueta">Nas caixinhas</span>
                          <Dinheiro cents={total.caixinhasCents} />
                        </div>
                      ) : null}
                      {total.cartoesCents !== 0 ? (
                        <div className="secao" style={{ gap: 4 }}>
                          <span className="etiqueta">Nos cartões</span>
                          <Dinheiro cents={-total.cartoesCents} />
                        </div>
                      ) : null}
                    </div>
                  </Bloco>
                );
              })()}
              <Bloco className="lista">
                {contas.dados.accounts.map((conta) => {
                  const resumo = resumoDaConta(conta, financas.dados?.entries ?? [], hoje);
                  const caixinhas = (contas.dados?.boxes ?? []).filter((item) => item.accountId === conta.id);
                  const guardado = caixinhas.reduce((soma, item) => soma + resumoDaCaixinha(item, financas.dados?.entries ?? [], hoje).saldoCents, 0);
                  return (
                    <LinhaComMovimento key={conta.id} to={`/financas/contas/${conta.id}`} className="linha atalho-de-linha" whileTap={{ backgroundColor: "var(--surface-2)" }}>
                      <span className="texto" style={{ flex: 1 }}>
                        <strong>{conta.name}</strong>
                        <span className="etiqueta">
                          {ROTULO_DO_TIPO_DE_CONTA[conta.kind]} · {conta.kind === "cartao" ? "Lançado na fatura" : "Saldo hoje"}
                          {caixinhas.length ? ` · ${caixinhas.length === 1 ? "1 caixinha" : `${caixinhas.length} caixinhas`} com ${reais(guardado)}` : ""}
                        </span>
                      </span>
                      <Dinheiro cents={resumo.saldoCents} />
                      <IonIcon icon={chevronForward} aria-hidden />
                    </LinhaComMovimento>
                  );
                })}
              </Bloco>
            </>
          )}
        </Cascata>
      ) : null}
      <NovaConta
        aberta={criando}
        aoFechar={() => setCriando(false)}
        aoCriada={() => {
          setCriando(false);
          void recarregar();
        }}
      />
    </Pagina>
  );
}
