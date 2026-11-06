import { IonAlert, IonButton, IonButtons, IonIcon, useIonToast, useIonViewWillEnter } from "@ionic/react";
import type { CompromissoDoDia, HojeResposta, PendenciaDoDia, PerguntaDeGasto, SessaoDaAgenda, Tarefa, VencimentoDoDia } from "@finnagent/contracts";
import { addOutline, cashOutline, chevronBack, chevronForward, sunnyOutline, trashOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { Fragment, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { enviar, pedir } from "../api/cliente";
import { reais } from "../api/formato";
import { Campo } from "../componentes/Campo";
import { Dinheiro, Estado } from "../componentes/Estado";
import { Pagina } from "../componentes/Pagina";
import { Selecao } from "../componentes/Selecao";
import { toque } from "../haptico";
import { Bloco, Cascata, Preenchimento, Troca, toqueDoDedo } from "../movimento";
import { useDados } from "../useDados";
import {
  andamento,
  centavosDosDigitos,
  detalhesDoVencimento,
  ehData,
  filhasDe,
  quandoTerminou,
  rotaDaPendencia,
  rotuloCurto,
  rotuloDoDia,
  somarDias,
} from "./hoje/dia";

/** O recuo de cada nível da árvore, em pixels: a caixa da filha alinha com o texto da mãe. */
const RECUO = 28;

/** O dia inteiro numa lista: anotar, marcar e apagar. A ordem e a edição ficam no web. */
export function Hoje() {
  const { search } = useLocation();
  const navegar = useNavigate();
  const [avisar] = useIonToast();
  const pedida = new URLSearchParams(search).get("date") ?? "";
  const date = ehData(pedida) ? pedida : "";
  const { dados, erro, carregando, recarregar } = useDados<HojeResposta>(date ? `/api/hoje?date=${date}` : "/api/hoje");
  const [direcao, setDirecao] = useState(1);
  const [ocupado, setOcupado] = useState("");
  const [novo, setNovo] = useState("");
  const [apagando, setApagando] = useState<Tarefa | null>(null);

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });

  function irPara(alvo: string | null, delta: number) {
    toque();
    setDirecao(delta);
    navegar({ pathname: "/inicio/hoje", search: alvo ? `?date=${alvo}` : "" }, { replace: true });
  }

  async function agir(chave: string, acao: () => Promise<unknown>, erroPadrao: string) {
    if (ocupado) return false;
    setOcupado(chave);
    try {
      await acao();
      toque();
      await recarregar();
      return true;
    } catch (error) {
      void avisar({ message: error instanceof Error ? error.message : erroPadrao, duration: 2400, position: "top", cssClass: "aviso-de-erro" });
      return false;
    } finally {
      setOcupado("");
    }
  }

  async function anotar() {
    const title = novo.trim();
    if (!title || !dados) return;
    const feito = await agir("nova", () => enviar("/api/tarefas", { id: crypto.randomUUID(), title, date: dados.date }), "Não foi possível anotar a tarefa.");
    if (feito) setNovo("");
  }

  const marcarTarefa = (item: Tarefa, done: boolean) =>
    agir(item.id, () => enviar(`/api/tarefas/${item.id}/concluir`, { done }, "PATCH"), "Não foi possível marcar a tarefa.");

  const apagarTarefa = (item: Tarefa) => agir(`apagar-${item.id}`, () => pedir(`/api/tarefas/${item.id}`, { method: "DELETE" }), "Não foi possível apagar a tarefa.");

  const marcarCompromisso = (item: CompromissoDoDia, done: boolean) =>
    agir(item.id, () => enviar(`/api/compromissos/${item.id}/status`, { status: done ? "done" : "undone" }, "PATCH"), "Não foi possível marcar o compromisso.");

  // Marcar paga na data de hoje: a parcela e o empréstimo registram um pagamento (desmarcar desfaz esse pagamento);
  // a única e a recorrente mudam a ocorrência para paga, no dia de hoje.
  const marcarVencimento = (item: VencimentoDoDia, done: boolean) =>
    agir(
      `${item.entryId}:${item.number}`,
      () => {
        const hoje = dados?.today ?? dados?.date;
        if (item.series && done) return enviar(`/api/lancamentos/${item.entryId}/pagamentos`, { date: hoje, cents: Math.abs(item.cents) });
        if (item.series && item.paymentId) return pedir(`/api/lancamentos/${item.entryId}/pagamentos/${item.paymentId}`, { method: "DELETE" });
        return enviar(`/api/lancamentos/${item.entryId}/ocorrencias/${item.number}`, done ? { status: "completed", paidOn: hoje } : { status: "pending" }, "PATCH");
      },
      "Não foi possível marcar o pagamento.",
    );

  // "Teve gasto?": lançar vira uma saída única paga no dia do compromisso; "não teve" só tira a pergunta.
  const lancarGasto = (item: PerguntaDeGasto, cents: number, sessionId: string) =>
    agir(
      `gasto-${item.appointmentId}:${item.date}`,
      () =>
        enviar(`/api/compromissos/${item.appointmentId}/gastos`, {
          id: crypto.randomUUID(),
          date: item.date,
          cents,
          ...(item.sessionId ? {} : { sessionId }),
        }),
      "Não foi possível lançar o gasto.",
    );

  const semGasto = (item: PerguntaDeGasto) =>
    agir(`gasto-${item.appointmentId}:${item.date}`, () => enviar(`/api/compromissos/${item.appointmentId}/sem-gasto`, { date: item.date }), "Não foi possível responder.");

  const tarefas = dados?.tarefas ?? [];
  const raizes = filhasDe(tarefas, null);
  const atrasados = dados ? dados.vencimentos.filter((item) => item.situation === "late") : [];
  const doDia = dados ? dados.vencimentos.filter((item) => item.situation !== "late") : [];
  const { feitas, total } = dados ? andamento(dados) : { feitas: 0, total: 0 };
  const ehHoje = dados ? dados.date === dados.today : true;
  const vazio = dados ? total === 0 && dados.pendencias.length === 0 : false;

  /** Uma tarefa com a árvore abaixo dela, cada nível mais recuado. */
  const atividade = (item: Tarefa, nivel: number): ReactNode => {
    if (!dados) return null;
    const filhas = filhasDe(tarefas, item.id);
    const feitasAqui = filhas.filter((filha) => filha.doneOn).length;
    const rotulo = `${nivel > 0 ? "Subatividade" : "Tarefa"} ${item.title}`;
    return (
      <Fragment key={item.id}>
        <Linha
          chave={item.id}
          nivel={nivel}
          feito={Boolean(item.doneOn)}
          ocupado={ocupado === item.id}
          rotulo={rotulo}
          onMarcar={(done) => void marcarTarefa(item, done)}
          titulo={item.title}
          detalhe={filhas.length > 0 ? `${feitasAqui} de ${filhas.length}` : undefined}
          chip={nivel === 0 && item.date < dados.date && !item.doneOn ? <span className="chip ia">Ficou de {rotuloCurto(item.date)}</span> : null}
          lado={
            <IonButton fill="clear" className="apagar" aria-label={`Apagar: ${rotulo}`} disabled={ocupado !== ""} onClick={() => setApagando(item)}>
              <IonIcon slot="icon-only" icon={trashOutline} />
            </IonButton>
          }
        />
        {filhas.map((filha) => atividade(filha, nivel + 1))}
      </Fragment>
    );
  };

  return (
    <Pagina
      titulo="Hoje"
      etiqueta="Tarefas, compromissos e pagamentos"
      semPerfil
      aoAtualizar={recarregar}
      fim={
        <IonButtons>
          <IonButton routerLink="/inicio" routerDirection="back" aria-label="Voltar">
            <IonIcon slot="icon-only" icon={chevronBack} />
          </IonButton>
        </IonButtons>
      }
    >
      <div className="pagina">
        <div className="seletor-de-mes">
          <motion.div whileTap={toqueDoDedo}>
            <IonButton fill="outline" size="small" aria-label="Dia anterior" disabled={!dados} onClick={() => dados && irPara(somarDias(dados.date, -1), -1)}>
              <IonIcon slot="icon-only" icon={chevronBack} />
            </IonButton>
          </motion.div>
          <strong style={{ flex: 1, textAlign: "center" }}>{dados ? rotuloDoDia(dados.date) : date ? rotuloDoDia(date) : "Hoje"}</strong>
          <motion.div whileTap={toqueDoDedo}>
            <IonButton fill="outline" size="small" aria-label="Dia seguinte" disabled={!dados} onClick={() => dados && irPara(somarDias(dados.date, 1), 1)}>
              <IonIcon slot="icon-only" icon={chevronForward} />
            </IonButton>
          </motion.div>
        </div>

        {dados && !ehHoje ? (
          <motion.div whileTap={toqueDoDedo}>
            <IonButton expand="block" fill="outline" onClick={() => irPara(null, dados.date < dados.today ? 1 : -1)}>
              <IonIcon slot="start" icon={sunnyOutline} />
              Voltar para hoje
            </IonButton>
          </motion.div>
        ) : null}

        <Troca chave={dados?.date ?? date} direcao={direcao}>
          <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

          {dados ? (
            <Cascata className="pagina sem-margem">
              {total > 0 ? (
                <Bloco className="cartao">
                  <div className="titulo-do-dia">
                    <span className="etiqueta">{feitas === total ? "Tudo feito" : "Andamento"}</span>
                    <span className="fraco">
                      {feitas} de {total}
                    </span>
                  </div>
                  <div className="barra" role="progressbar" aria-label="Andamento do dia" aria-valuenow={feitas} aria-valuemin={0} aria-valuemax={total}>
                    <Preenchimento porcento={Math.round((feitas / total) * 100)} />
                  </div>
                </Bloco>
              ) : null}

              {/* Uma lista só, como uma lista de papel: a pergunta do gasto vem antes, depois o campo de anotar. */}
              <Bloco className="lista-do-dia">
                <Grupo titulo="Teve gasto?" vazio={(dados.gastos ?? []).length === 0}>
                  {(dados.gastos ?? []).map((item) => (
                    <PerguntaDoGasto
                      key={`${item.appointmentId}:${item.date}`}
                      item={item}
                      today={dados.today}
                      sessoes={dados.sessoesParaGasto ?? []}
                      ocupado={ocupado !== ""}
                      onLancar={(cents, sessionId) => lancarGasto(item, cents, sessionId)}
                      onSemGasto={() => void semGasto(item)}
                    />
                  ))}
                </Grupo>

                <form
                  className="linha-de-anotar"
                  onSubmit={(evento) => {
                    evento.preventDefault();
                    void anotar();
                  }}
                >
                  <span className="caixa-vazia" aria-hidden />
                  <input
                    id="nova-tarefa"
                    aria-label="Nova tarefa"
                    placeholder={ehHoje ? "Anotar uma tarefa para hoje" : `Anotar para ${rotuloCurto(dados.date)}`}
                    maxLength={160}
                    enterKeyHint="done"
                    autoCapitalize="sentences"
                    value={novo}
                    onChange={(evento) => setNovo(evento.target.value)}
                  />
                  <IonButton type="submit" fill="clear" className="apagar" aria-label="Adicionar tarefa" disabled={!novo.trim() || ocupado !== ""}>
                    <IonIcon slot="icon-only" icon={addOutline} />
                  </IonButton>
                </form>

                {vazio && (dados.gastos ?? []).length === 0 ? <p className="fraco vazio-do-dia">Nada marcado para este dia.</p> : null}

                <Grupo titulo="Atrasados" vazio={atrasados.length === 0}>
                  {atrasados.map((item) => (
                    <Linha
                      key={`${item.entryId}:${item.number}`}
                      chave={`${item.entryId}:${item.number}`}
                      feito={false}
                      ocupado={ocupado === `${item.entryId}:${item.number}`}
                      rotulo={`Pagamento ${item.description}`}
                      onMarcar={(done) => void marcarVencimento(item, done)}
                      titulo={item.description}
                      detalhe={detalhesDoVencimento(item)}
                      chip={<span className="chip neg">Venceu em {rotuloCurto(item.dueDate)}</span>}
                      lado={<Dinheiro cents={item.cents} />}
                    />
                  ))}
                </Grupo>

                <Grupo titulo="Compromissos" vazio={dados.compromissos.length === 0}>
                  {dados.compromissos.map((item) => (
                    <Linha
                      key={item.id}
                      chave={item.id}
                      feito={item.status === "done"}
                      ocupado={ocupado === item.id}
                      rotulo={`Compromisso ${item.title}`}
                      onMarcar={(done) => void marcarCompromisso(item, done)}
                      hora={item.allDay ? "Dia todo" : item.time}
                      titulo={item.title}
                      detalhe={[item.location, item.endTime ? `até ${item.endTime}` : ""].filter(Boolean).join(" · ")}
                      lado={<span className="chip evento">{item.calendar}</span>}
                    />
                  ))}
                </Grupo>

                <Grupo titulo={ehHoje ? "Pagamentos de hoje" : "Pagamentos do dia"} vazio={doDia.length === 0}>
                  {doDia.map((item) => (
                    <Linha
                      key={`${item.entryId}:${item.number}`}
                      chave={`${item.entryId}:${item.number}`}
                      feito={item.situation === "completed"}
                      ocupado={ocupado === `${item.entryId}:${item.number}`}
                      rotulo={`Pagamento ${item.description}`}
                      onMarcar={(done) => void marcarVencimento(item, done)}
                      titulo={item.description}
                      detalhe={detalhesDoVencimento(item)}
                      lado={<Dinheiro cents={item.cents} />}
                    />
                  ))}
                </Grupo>

                <Grupo titulo="Para fazer" vazio={raizes.every((item) => item.doneOn) && dados.pendencias.length === 0}>
                  {raizes.filter((item) => !item.doneOn).map((item) => atividade(item, 0))}
                  {dados.pendencias.map((item) => (
                    <Pendencia key={item.id} item={item} />
                  ))}
                </Grupo>

                <Grupo titulo="Feito" vazio={!raizes.some((item) => item.doneOn)}>
                  {raizes.filter((item) => item.doneOn).map((item) => atividade(item, 0))}
                </Grupo>
              </Bloco>
            </Cascata>
          ) : null}
        </Troca>
      </div>

      <IonAlert
        isOpen={apagando !== null}
        header="Apagar esta tarefa?"
        message={apagando ? `"${apagando.title}"${filhasDe(tarefas, apagando.id).length > 0 ? " e as subatividades dela" : ""} sai da lista. Não pode ser desfeito.` : ""}
        buttons={[
          { text: "Cancelar", role: "cancel" },
          { text: "Apagar", role: "destructive", handler: () => (apagando ? void apagarTarefa(apagando) : undefined) },
        ]}
        onDidDismiss={() => setApagando(null)}
      />
    </Pagina>
  );
}

/** Um grupo da lista: a etiqueta como linha de cabeçalho e as linhas abaixo, no mesmo quadro. */
function Grupo({ titulo, vazio, children }: { titulo: string; vazio: boolean; children: ReactNode }) {
  if (vazio) return null;
  return (
    <section aria-label={titulo} className="grupo-do-dia">
      <h2 className="etiqueta cabeca-do-grupo">{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * Uma linha da lista: a caixa, a hora quando há, o título com o detalhe e, à direita, o valor, o chip ou o botão
 * de apagar. A linha inteira é o alvo de toque da caixa. O que já foi feito fica riscado e apagado, sem sair do lugar.
 */
function Linha({
  chave,
  nivel = 0,
  feito,
  ocupado,
  rotulo,
  onMarcar,
  hora,
  titulo,
  detalhe,
  chip,
  lado,
}: {
  chave: string;
  nivel?: number;
  feito: boolean;
  ocupado: boolean;
  rotulo: string;
  onMarcar: (done: boolean) => void;
  hora?: string | null;
  titulo: string;
  detalhe?: string;
  chip?: ReactNode;
  lado?: ReactNode;
}) {
  const id = `item-${chave}`;
  return (
    <motion.div
      className={`linha-do-dia${feito ? " feita" : ""}`}
      style={{ paddingLeft: 16 + nivel * RECUO }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ backgroundColor: "var(--surface-2)" }}
    >
      <label className="marcar" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className="caixa"
          checked={feito}
          disabled={ocupado}
          aria-label={feito ? `Desmarcar: ${rotulo}` : `Marcar como feito: ${rotulo}`}
          onChange={(evento) => onMarcar(evento.target.checked)}
        />
        {hora !== undefined ? <time className="hora">{hora ?? ""}</time> : null}
        <span className="texto">
          <span>{titulo}</span>
          {detalhe || chip ? (
            <span className="detalhe">
              {chip}
              {detalhe ? <span>{detalhe}</span> : null}
            </span>
          ) : null}
        </span>
      </label>
      {lado ? <span className="lado">{lado}</span> : null}
    </motion.div>
  );
}

/** Uma pendência que o sistema enxerga: não se marca, leva para a tela que resolve. */
function Pendencia({ item }: { item: PendenciaDoDia }) {
  return (
    <Link to={rotaDaPendencia(item.href)} className="linha-do-dia pendencia">
      <span className="caixa-vazia" aria-hidden />
      <span className="texto">
        <span>{item.title}</span>
        <span className="detalhe">{item.detail}</span>
      </span>
      <IonIcon icon={chevronForward} aria-hidden className="fraco" />
    </Link>
  );
}

/**
 * Um compromisso que terminou: quanto se gastou nele. O valor entra só com dígitos e aparece em reais; sem sessão
 * de gastos no compromisso, a pessoa escolhe uma. "Lançar" vira uma saída paga no dia; "Não teve" tira a pergunta.
 */
function PerguntaDoGasto({
  item,
  today,
  sessoes,
  ocupado,
  onLancar,
  onSemGasto,
}: {
  item: PerguntaDeGasto;
  today: string;
  sessoes: SessaoDaAgenda[];
  ocupado: boolean;
  onLancar: (cents: number, sessionId: string) => Promise<boolean>;
  onSemGasto: () => void;
}) {
  const [cents, setCents] = useState(0);
  const [sessao, setSessao] = useState("");
  const sessionId = item.sessionId ?? sessao;
  const pode = cents > 0 && sessionId !== "" && !ocupado;

  return (
    <motion.div className="secao" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <span className="texto" style={{ display: "grid", minWidth: 0 }}>
        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</strong>
        <span className="fraco" style={{ fontSize: "0.875rem" }}>
          {[quandoTerminou(item, today), item.location, item.sessionLabel].filter(Boolean).join(" · ")}
        </span>
      </span>
      {item.sessionId ? null : (
        <Selecao rotulo="Sessão do gasto" valor={sessao} vazio="Escolha a sessão" opcoes={sessoes.map((opcao) => ({ id: opcao.id, texto: opcao.label }))} aoMudar={setSessao} desabilitado={ocupado} />
      )}
      <Campo
        icone={cashOutline}
        rotulo={`Quanto gastou em ${item.title}`}
        placeholder="R$ 0,00"
        inputMode="numeric"
        enterKeyHint="done"
        value={cents > 0 ? reais(cents) : ""}
        onMudar={(texto) => setCents(centavosDosDigitos(texto))}
        disabled={ocupado}
      />
      <div className="grade">
        <motion.div whileTap={toqueDoDedo}>
          <IonButton expand="block" fill="outline" disabled={ocupado} onClick={onSemGasto}>
            Não teve
          </IonButton>
        </motion.div>
        <motion.div whileTap={toqueDoDedo}>
          <IonButton
            expand="block"
            className="principal"
            disabled={!pode}
            onClick={async () => {
              if (pode && (await onLancar(cents, sessionId))) setCents(0);
            }}
          >
            Lançar
          </IonButton>
        </motion.div>
      </div>
    </motion.div>
  );
}
