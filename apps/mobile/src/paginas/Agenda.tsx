import { useIonViewWillEnter } from "@ionic/react";
import type { AgendaResposta, Compromisso } from "@finnagent/contracts";
import { calendarOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { useMemo } from "react";
import { diaDaSemana, rotuloDoMes } from "../api/formato";
import { Estado, Vazio } from "../componentes/Estado";
import { Pagina } from "../componentes/Pagina";
import { SeletorDeMes } from "../componentes/SeletorDeMes";
import { Bloco, Cascata, Troca } from "../movimento";
import { useDados } from "../useDados";
import { useMes } from "../useMes";

type Dia = { dia: number; feriados: string[]; compromissos: Compromisso[] };

function montarDias(agenda: AgendaResposta): Dia[] {
  const dias = new Map<number, Dia>();
  const dia = (numero: number) => {
    const atual = dias.get(numero) ?? { dia: numero, feriados: [], compromissos: [] };
    dias.set(numero, atual);
    return atual;
  };
  for (const compromisso of agenda.appointments) dia(compromisso.day).compromissos.push(compromisso);
  for (const feriado of agenda.holidays) dia(Number(feriado.data.slice(8, 10))).feriados.push(feriado.nome);
  return [...dias.values()].sort((a, b) => a.dia - b.dia);
}

export function Agenda() {
  const { mes, direcao, mudar } = useMes();
  const { dados, erro, carregando, recarregar } = useDados<AgendaResposta>(`/api/agenda?year=${mes.ano}&month=${mes.mes}`);
  const dias = useMemo(() => (dados ? montarDias(dados) : []), [dados]);
  const hoje = new Date();
  const ehEsteMes = hoje.getFullYear() === mes.ano && hoje.getMonth() + 1 === mes.mes;

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });

  return (
    <Pagina titulo="Agenda" etiqueta="Compromissos e feriados" aoAtualizar={recarregar}>
      <div className="pagina">
        <SeletorDeMes mes={mes} direcao={direcao} aoMudar={mudar} />

        <Troca chave={rotuloDoMes(mes)} direcao={direcao}>
          <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

          {dados && dias.length === 0 ? (
            <Vazio icone={calendarOutline} titulo="Mês livre" texto="Nenhum compromisso nem feriado. Peça ao consultor para marcar algo." />
          ) : null}

          {dados && dias.length > 0 ? (
            <Cascata className="pagina sem-margem">
              {dias.map((dia) => {
                const ehHoje = ehEsteMes && dia.dia === hoje.getDate();
                return (
                  <Bloco key={dia.dia} className={`dia-da-agenda${ehHoje ? " hoje" : ""}`}>
                    <div className="data">
                      <strong>{String(dia.dia).padStart(2, "0")}</strong>
                      <span className="etiqueta">{diaDaSemana(mes.ano, mes.mes, dia.dia)}</span>
                    </div>
                    <div className="lista" style={{ flex: 1 }}>
                      {dia.feriados.map((nome) => (
                        <div key={nome} className="linha">
                          <div className="texto">
                            <span>{nome}</span>
                            <span className="etiqueta">Feriado</span>
                          </div>
                        </div>
                      ))}
                      {dia.compromissos.map((compromisso) => (
                        <motion.div key={compromisso.id} className="linha evento" whileTap={{ backgroundColor: "var(--surface-2)" }}>
                          <div className="texto">
                            <span style={compromisso.status === "done" ? { textDecoration: "line-through", color: "var(--ink-2)" } : undefined}>{compromisso.title}</span>
                            <span className="etiqueta">{[compromisso.allDay ? "Dia todo" : compromisso.time, compromisso.location].filter(Boolean).join(" · ")}</span>
                          </div>
                          {compromisso.status === "done" ? <span className="etiqueta pos">Feito</span> : null}
                        </motion.div>
                      ))}
                    </div>
                  </Bloco>
                );
              })}
            </Cascata>
          ) : null}
        </Troca>
      </div>
    </Pagina>
  );
}
