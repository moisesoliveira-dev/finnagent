import { IonButton, IonIcon, useIonViewWillEnter } from "@ionic/react";
import type { AgendaResposta, Compromisso } from "@finnagent/contracts";
import { calendarOutline, syncOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { enviar, pedir } from "../api/cliente";
import { dataCurta, diaDaSemana, ehDataIso, hojeIso, rotuloDoMes } from "../api/formato";
import { Campo } from "../componentes/Campo";
import { Data } from "../componentes/Data";
import { Folha } from "../componentes/Folha";
import { toque } from "../haptico";
import { useAcao } from "../useAcao";
import { FormCompromisso, ROTULO_DA_REPETICAO } from "./agenda/FormCompromisso";
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

  const { ocupado, agir, confirmar } = useAcao();
  const [aberto, setAberto] = useState<Compromisso | null>(null);
  const [formulario, setFormulario] = useState<{ compromisso: Compromisso | null } | null>(null);
  const [novoDia, setNovoDia] = useState("");
  const conectado = dados && dados.google !== "desconectado";
  const dataNova = ehEsteMes ? hojeIso() : `${mes.ano}-${String(mes.mes).padStart(2, "0")}-01`;

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });

  async function fazer(chave: string, acao: () => Promise<unknown>, sucesso: string, fechar = false) {
    if (!(await agir(chave, acao, sucesso))) return;
    if (fechar) setAberto(null);
    await recarregar();
  }

  function abrir(item: Compromisso) {
    toque();
    setNovoDia(`${item.year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`);
    setAberto(item);
  }

  return (
    <Pagina
      titulo="Agenda"
      etiqueta="Compromissos e feriados"
      aoAtualizar={recarregar}
      acao={{ rotulo: "Novo compromisso", aoTocar: () => setFormulario({ compromisso: null }) }}
      fim={
        <>
          {conectado ? (
            <IonButton
              aria-label="Sincronizar com o Google Agenda"
              disabled={Boolean(ocupado)}
              onClick={() => void fazer("sincronizar", () => enviar("/api/agenda/sincronizar", {}), "Agenda sincronizada com o Google.")}
            >
              <IonIcon slot="icon-only" icon={syncOutline} />
            </IonButton>
          ) : null}
        </>
      }
    >
      <div className="pagina">
        <SeletorDeMes mes={mes} direcao={direcao} aoMudar={mudar} />

        <Troca chave={rotuloDoMes(mes)} direcao={direcao}>
          <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

          {dados && dias.length === 0 ? (
            <Vazio icone={calendarOutline} titulo="Mês livre" texto="Nenhum compromisso nem feriado. Toque em + para marcar algo." />
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
                        <motion.button
                          type="button"
                          key={compromisso.id}
                          className="linha evento linha-botao"
                          whileTap={{ backgroundColor: "var(--surface-2)" }}
                          onClick={() => abrir(compromisso)}
                        >
                          <div className="texto">
                            <span style={compromisso.status === "done" ? { textDecoration: "line-through", color: "var(--ink-2)" } : undefined}>{compromisso.title}</span>
                            <span className="etiqueta">{[compromisso.allDay ? "Dia todo" : compromisso.time, compromisso.location].filter(Boolean).join(" · ")}</span>
                          </div>
                          {compromisso.status === "done" ? <span className="etiqueta pos">Feito</span> : null}
                        </motion.button>
                      ))}
                    </div>
                  </Bloco>
                );
              })}
            </Cascata>
          ) : null}
        </Troca>
      </div>

      <Folha aberta={aberto !== null} titulo={aberto?.title ?? ""} aoFechar={() => setAberto(null)}>
        {aberto ? (
          <>
            <div className="cartao">
              <span className="etiqueta">
                {dataCurta(`${aberto.year}-${String(aberto.month).padStart(2, "0")}-${String(aberto.day).padStart(2, "0")}`)} ·{" "}
                {aberto.allDay ? "Dia todo" : `${aberto.time ?? ""}${aberto.endTime ? `–${aberto.endTime}` : ""}`}
              </span>
              <strong>{aberto.title}</strong>
              <div className="chips">
                <span className="chip">{ROTULO_DA_REPETICAO[aberto.category]}</span>
                <span className="chip">{aberto.calendar}</span>
                {aberto.status === "done" ? <span className="chip ok">Feito</span> : null}
              </div>
              {aberto.location ? <span className="fraco">{aberto.location}</span> : null}
              {aberto.description ? <span className="fraco">{aberto.description}</span> : null}
              {aberto.sessionLabel ? <span className="fraco">Gastos em {aberto.sessionLabel}</span> : null}
            </div>
            <div className="acoes-da-folha">
              <IonButton
                className="principal"
                disabled={Boolean(ocupado)}
                onClick={() =>
                  void fazer(
                    "status",
                    () => enviar(`/api/compromissos/${aberto.id}/status`, { status: aberto.status === "done" ? "undone" : "done" }, "PATCH"),
                    aberto.status === "done" ? "Voltou a pendente." : "Marcado como feito.",
                    true,
                  )
                }
              >
                {aberto.status === "done" ? "Desmarcar" : "Marcar como feito"}
              </IonButton>
              <IonButton
                fill="outline"
                disabled={Boolean(ocupado)}
                onClick={() => {
                  const item = aberto;
                  setAberto(null);
                  setFormulario({ compromisso: item });
                }}
              >
                Editar
              </IonButton>
            </div>
            <section className="secao">
              <h2 className="etiqueta">Mudar o dia</h2>
              <Data rotulo="Novo dia" valor={novoDia} aoMudar={setNovoDia} />
              <IonButton
                fill="outline"
                disabled={Boolean(ocupado) || !ehDataIso(novoDia)}
                onClick={() => {
                  const [year, month, day] = novoDia.split("-").map(Number);
                  void fazer("mover", () => enviar(`/api/compromissos/${aberto.id}/mover`, { year, month, day }), "Compromisso movido.", true);
                }}
              >
                Mover para este dia
              </IonButton>
            </section>
            <IonButton
              expand="block"
              fill="clear"
              color="danger"
              disabled={Boolean(ocupado)}
              onClick={() =>
                confirmar(
                  "Apagar este compromisso?",
                  aberto.category === "fixed" ? "Não pode ser desfeito." : "Ele se repete: todas as vezes saem da agenda. Não pode ser desfeito.",
                  "Apagar",
                  () => void fazer("apagar", () => pedir(`/api/compromissos/${aberto.id}`, { method: "DELETE" }), "Compromisso apagado.", true),
                )
              }
            >
              Apagar o compromisso
            </IonButton>
          </>
        ) : null}
      </Folha>

      <FormCompromisso
        aberta={formulario !== null}
        compromisso={formulario?.compromisso ?? null}
        agenda={dados}
        dataInicial={dataNova}
        aoFechar={() => setFormulario(null)}
        aoSalvo={() => {
          setFormulario(null);
          void recarregar();
        }}
      />
    </Pagina>
  );
}
