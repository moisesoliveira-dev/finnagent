import { IonButton, useIonViewWillEnter } from "@ionic/react";
import type { Meta, MetasResposta } from "@finnagent/contracts";
import { flagOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { enviar } from "../api/cliente";
import { MESES_CURTOS, reais } from "../api/formato";
import { Dinheiro, Estado, Vazio } from "../componentes/Estado";
import { Pagina } from "../componentes/Pagina";
import { toque } from "../haptico";
import { Bloco, Cascata, Contagem, Preenchimento, toqueDoDedo } from "../movimento";
import { useDados } from "../useDados";

const porcentoDe = (meta: Meta) => (meta.targetCents > 0 ? Math.min(100, Math.round((meta.savedCents / meta.targetCents) * 100)) : 0);

/** Quantos meses faltam para o prazo, contando o atual. Zero ou negativo: o prazo já passou. */
function mesesAte(meta: Meta) {
  if (!meta.dueYear || !meta.dueMonth) return null;
  const hoje = new Date();
  return meta.dueYear * 12 + meta.dueMonth - (hoje.getFullYear() * 12 + hoje.getMonth() + 1) + 1;
}

export function Metas() {
  const { dados, erro, carregando, recarregar } = useDados<MetasResposta>("/api/metas");
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [erroAoAprovar, setErroAoAprovar] = useState("");

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });

  async function aprovar(meta: Meta) {
    setAprovando(meta.id);
    setErroAoAprovar("");
    try {
      await enviar<void>(`/api/metas/${meta.id}/aprovar`, {});
      toque(true);
      await recarregar();
    } catch (error) {
      setErroAoAprovar(error instanceof Error ? error.message : "Não foi possível aprovar.");
    } finally {
      setAprovando(null);
    }
  }

  return (
    <Pagina titulo="Metas" etiqueta="Pela ordem de prioridade" aoAtualizar={recarregar}>
      <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

      {dados ? (
        <Cascata className="pagina">
          {erroAoAprovar ? <Bloco><p className="erro">{erroAoAprovar}</p></Bloco> : null}

          <Bloco className="cartao destaque">
            <span className="etiqueta">Sobra do mês para as metas</span>
            <span className="numero grande">
              <Dinheiro cents={dados.surplusCents} animado />
            </span>
            <span className="fraco">
              Já separado neste mês: <Contagem valor={dados.separatedCents} formatar={reais} />
            </span>
          </Bloco>

          {dados.goals.length === 0 ? (
            <Bloco>
              <Vazio icone={flagOutline} titulo="Nenhuma meta ainda" texto="Diga ao consultor o que você quer juntar e até quando.">
                <Link to="/assistente" className="botao-link">
                  Falar com o consultor
                </Link>
              </Vazio>
            </Bloco>
          ) : null}

          {[...dados.goals]
            .sort((a, b) => a.position - b.position)
            .map((meta, indice) => {
              const divisao = dados.division[meta.id];
              const pendente = divisao && !divisao.approved;
              const porcento = porcentoDe(meta);
              const restante = Math.max(0, meta.targetCents - meta.savedCents);
              const meses = mesesAte(meta);
              const porMes = meses && meses > 0 && restante > 0 ? Math.ceil(restante / meses) : null;
              return (
                <Bloco key={meta.id} className="cartao">
                  <div className="linha-da-meta">
                    <span className="posicao" aria-label={`Prioridade ${indice + 1}`}>
                      {indice + 1}
                    </span>
                    <div className="texto" style={{ flex: 1 }}>
                      <strong>{meta.name}</strong>
                      <span className="etiqueta">{meta.dueMonth && meta.dueYear ? `Até ${MESES_CURTOS[meta.dueMonth - 1]}/${meta.dueYear}` : "Sem prazo"}</span>
                    </div>
                    <Contagem valor={porcento} formatar={(valor) => `${valor}%`} className="numero" />
                  </div>
                  <div className="barra" role="progressbar" aria-valuenow={porcento} aria-valuemin={0} aria-valuemax={100} aria-label={`${meta.name}: ${porcento}%`}>
                    <Preenchimento porcento={porcento} atraso={indice * 0.1} />
                  </div>
                  <div className="grade">
                    <div className="secao" style={{ gap: 4 }}>
                      <span className="etiqueta">Juntado</span>
                      <span>{reais(meta.savedCents)}</span>
                    </div>
                    <div className="secao" style={{ gap: 4 }}>
                      <span className="etiqueta">Falta</span>
                      <span>{reais(restante)}</span>
                    </div>
                  </div>
                  {porMes ? (
                    <span className="fraco">
                      Para chegar no prazo: cerca de <strong style={{ color: "var(--ink)" }}>{reais(porMes)}</strong> por mês.
                    </span>
                  ) : meses !== null && meses <= 0 && restante > 0 ? (
                    <span className="fraco">O prazo já passou. Peça ao consultor para ajustar.</span>
                  ) : null}
                  <AnimatePresence initial={false}>
                    {pendente ? (
                      <motion.div
                        key="pendente"
                        className="aviso"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: "hidden" }}
                      >
                        <p style={{ margin: "0 0 8px" }}>
                          {divisao.percent}% da sobra deste mês ({reais(divisao.cents)}) esperam a sua aprovação.
                        </p>
                        <motion.div whileTap={toqueDoDedo} style={{ display: "inline-block" }}>
                          <IonButton size="small" className="principal" disabled={aprovando === meta.id} onClick={() => void aprovar(meta)}>
                            Aprovar
                          </IonButton>
                        </motion.div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </Bloco>
              );
            })}
        </Cascata>
      ) : null}
    </Pagina>
  );
}
