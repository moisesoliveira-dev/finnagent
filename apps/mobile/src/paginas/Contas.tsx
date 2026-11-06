import { IonButton, IonButtons, IonIcon, useIonViewWillEnter } from "@ionic/react";
import { ROTULO_DO_TIPO_DE_CONTA, resumoDaConta, type ContasResposta, type FinancasVista } from "@finnagent/contracts";
import { chevronBack, chevronForward, walletOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Dinheiro, Estado, Vazio } from "../componentes/Estado";
import { Pagina } from "../componentes/Pagina";
import { Bloco, Cascata } from "../movimento";
import { useDados } from "../useDados";
import { hojeIso } from "./contas/movimentos";

const LinhaComMovimento = motion.create(Link);

/** As contas e os cartões, com o saldo de cada um. Tocar abre o detalhe. Criar e editar ficam no web. */
export function Contas() {
  const contas = useDados<ContasResposta>("/api/contas");
  const financas = useDados<FinancasVista>("/api/financas");
  const hoje = hojeIso();

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
              <Vazio icone={walletOutline} titulo="Nenhuma conta ainda" texto="Cadastre a conta do banco e o cartão pelo site. O extrato importado também cria a conta." />
            </Bloco>
          ) : (
            <Bloco className="lista">
              {contas.dados.accounts.map((conta) => {
                const resumo = resumoDaConta(conta, financas.dados?.entries ?? [], hoje);
                return (
                  <LinhaComMovimento key={conta.id} to={`/financas/contas/${conta.id}`} className="linha atalho-de-linha" whileTap={{ backgroundColor: "var(--surface-2)" }}>
                    <span className="texto" style={{ flex: 1 }}>
                      <strong>{conta.name}</strong>
                      <span className="etiqueta">
                        {ROTULO_DO_TIPO_DE_CONTA[conta.kind]} · {conta.kind === "cartao" ? "Lançado na fatura" : "Saldo hoje"}
                      </span>
                    </span>
                    <Dinheiro cents={resumo.saldoCents} />
                    <IonIcon icon={chevronForward} aria-hidden />
                  </LinhaComMovimento>
                );
              })}
            </Bloco>
          )}
        </Cascata>
      ) : null}
    </Pagina>
  );
}
