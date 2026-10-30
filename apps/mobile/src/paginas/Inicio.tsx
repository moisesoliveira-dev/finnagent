import { IonIcon, useIonViewWillEnter } from "@ionic/react";
import type { ItemPainel, PainelResposta } from "@finnagent/contracts";
import { chatbubbleEllipsesOutline, chevronForward } from "ionicons/icons";
import { motion } from "motion/react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MESES, reais } from "../api/formato";
import { sessaoAtual } from "../api/sessao";
import { BarrasDoAno } from "../componentes/BarrasDoAno";
import { Dinheiro, Estado } from "../componentes/Estado";
import { Pagina } from "../componentes/Pagina";
import { Bloco, Cascata, Contagem, Preenchimento, toqueDoDedo } from "../movimento";
import { useDados } from "../useDados";

const AtalhoComMovimento = motion.create(Link);

/** Saídas que ainda vão acontecer neste mês, da mais próxima para a mais distante. */
function proximas(items: ItemPainel[], hoje: number) {
  return items
    .filter(
      // O que a pessoa separa para uma meta sai do mês, mas não é uma conta a pagar.
      (item) => item.kind === "lancamento" && item.cents !== null && item.cents < 0 && item.day >= hoje && !item.detail.startsWith("Metas ·"),
    )
    .sort((a, b) => a.day - b.day)
    .slice(0, 4);
}

function saudacao() {
  const hora = new Date().getHours();
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

export function Inicio() {
  const hoje = useMemo(() => {
    const agora = new Date();
    return { ano: agora.getFullYear(), mes: agora.getMonth() + 1, dia: agora.getDate() };
  }, []);
  const doMes = useDados<PainelResposta>(`/api/painel?scope=mes&year=${hoje.ano}&month=${hoje.mes}`);
  const doDia = useDados<PainelResposta>(`/api/painel?scope=dia&year=${hoje.ano}&month=${hoje.mes}&day=${hoje.dia}`);
  const doAno = useDados<PainelResposta>(`/api/painel?scope=ano&year=${hoje.ano}`);
  const nome = sessaoAtual()?.user.name.split(" ")[0] ?? "";

  const recarregarTudo = () => Promise.all([doMes.recarregar(), doDia.recarregar(), doAno.recarregar()]).then(() => undefined);
  useIonViewWillEnter(() => {
    if (doMes.dados) void recarregarTudo();
  });

  const painel = doMes.dados;
  const usoDasEntradas = painel && painel.entradas > 0 ? Math.round((Math.abs(painel.saidas) / painel.entradas) * 100) : null;
  const vindouras = painel ? proximas(painel.items, hoje.dia) : [];

  return (
    <Pagina titulo={nome ? `${saudacao()}, ${nome}` : saudacao()} etiqueta={`${MESES[hoje.mes - 1]} de ${hoje.ano}`} aoAtualizar={recarregarTudo}>
      <Estado carregando={doMes.carregando} erro={doMes.erro} tem={Boolean(painel)} aoTentar={() => void doMes.recarregar()} />

      {painel ? (
        <Cascata className="pagina">
          <Bloco className="cartao destaque">
            <span className="etiqueta">Sobra do mês</span>
            <span className="numero grande">
              <Dinheiro cents={painel.sobra} animado />
            </span>
            {usoDasEntradas !== null ? (
              <>
                <div
                  className="barra"
                  role="progressbar"
                  aria-label="Parte das entradas já usada pelas saídas"
                  aria-valuenow={Math.min(usoDasEntradas, 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <Preenchimento porcento={Math.min(usoDasEntradas, 100)} className={usoDasEntradas > 100 ? "perigo" : undefined} />
                </div>
                <span className="fraco">
                  {usoDasEntradas > 100
                    ? `As saídas passaram das entradas em ${usoDasEntradas - 100}%.`
                    : `Você já usou ${usoDasEntradas}% das entradas do mês.`}
                </span>
              </>
            ) : (
              <span className="fraco">Sem entradas lançadas neste mês.</span>
            )}
            <div className="grade separada">
              <div className="secao" style={{ gap: 4 }}>
                <span className="etiqueta">Entradas</span>
                <Contagem valor={painel.entradas} formatar={reais} className="numero pos" />
              </div>
              <div className="secao" style={{ gap: 4 }}>
                <span className="etiqueta">Saídas</span>
                <Contagem valor={painel.saidas} formatar={reais} className="numero neg" />
              </div>
            </div>
          </Bloco>

          {painel.avisos.length > 0 || painel.semConferir > 0 ? (
            <Bloco className="secao">
              <div className="secao" style={{ gap: 8 }}>
                {painel.avisos.map((aviso) => (
                  <p key={aviso.id} className="aviso">
                    <span className="etiqueta" style={{ color: "inherit" }}>
                      {aviso.kind === "lembrete" ? "Lembrete" : "Vence hoje"}
                    </span>
                    <br />
                    {aviso.title}
                  </p>
                ))}
                {painel.semConferir > 0 ? (
                  <Link to="/extratos?aba=conferencia" className="aviso aviso-link">
                    {painel.semConferir} {painel.semConferir === 1 ? "linha de extrato" : "linhas de extrato"} sem lançamento: esse dinheiro ainda não entrou nos totais.
                    <strong> Conferir agora</strong>
                  </Link>
                ) : null}
              </div>
            </Bloco>
          ) : null}

          <Bloco>
            <AtalhoComMovimento to="/assistente" className="atalho" whileTap={toqueDoDedo}>
              <IonIcon icon={chatbubbleEllipsesOutline} aria-hidden />
              <span className="texto">
                <strong>Pergunte ao consultor</strong>
                <span className="fraco">Lançar, planejar ou entender o seu mês</span>
              </span>
              <motion.span style={{ display: "inline-flex" }} animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}>
                <IonIcon icon={chevronForward} aria-hidden />
              </motion.span>
            </AtalhoComMovimento>
          </Bloco>

          <Bloco className="secao">
            <span className="etiqueta">Próximas saídas</span>
            {vindouras.length === 0 ? (
              <p className="fraco">Nenhuma saída pela frente neste mês.</p>
            ) : (
              <div className="lista">
                {vindouras.map((item) => (
                  <motion.div key={`${item.kind}-${item.id}`} className="linha" whileTap={{ backgroundColor: "var(--surface-2)" }}>
                    <span className="dia" aria-label={`dia ${item.day}`}>
                      {String(item.day).padStart(2, "0")}
                    </span>
                    <div className="texto" style={{ flex: 1 }}>
                      <span>{item.title}</span>
                      <span className="etiqueta">{item.day === hoje.dia ? "Hoje" : `Em ${item.day - hoje.dia} dias`}</span>
                    </div>
                    <Dinheiro cents={item.cents ?? 0} />
                  </motion.div>
                ))}
              </div>
            )}
          </Bloco>

          <Bloco className="secao">
            <span className="etiqueta">Hoje</span>
            {doDia.dados && doDia.dados.items.length === 0 ? <p className="fraco">Nada marcado para hoje.</p> : null}
            {doDia.dados?.items.length ? (
              <div className="lista">
                {doDia.dados.items.map((item) => (
                  <motion.div
                    key={`${item.kind}-${item.id}`}
                    className={`linha${item.kind === "compromisso" ? " evento" : ""}`}
                    whileTap={{ backgroundColor: "var(--surface-2)" }}
                  >
                    <div className="texto">
                      <span>{item.title}</span>
                      <span className="etiqueta">{item.time ?? item.detail}</span>
                    </div>
                    {item.cents === null ? <span className="etiqueta">Compromisso</span> : <Dinheiro cents={item.cents} />}
                  </motion.div>
                ))}
              </div>
            ) : null}
          </Bloco>

          {doAno.dados ? (
            <Bloco className="cartao">
              <span className="etiqueta">Sobra mês a mês em {hoje.ano}</span>
              <BarrasDoAno meses={doAno.dados.months} atual={hoje.mes} />
              <span className="fraco">
                No ano: <Dinheiro cents={doAno.dados.sobra} />
              </span>
            </Bloco>
          ) : null}
        </Cascata>
      ) : null}
    </Pagina>
  );
}
