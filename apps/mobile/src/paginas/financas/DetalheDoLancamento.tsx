import { IonButton } from "@ionic/react";
import { dataContabil, fraseDoPlanoDeParcelas, pendentesDaSerie, planoDoPagamentoDeParcelas, type DiferencaDoPagamento, type LancamentoVista, type OcorrenciaVista, type StatusTransacao } from "@finnagent/contracts";
import { arrowUndoOutline, closeCircleOutline, createOutline, trashOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { enviar, pedir } from "../../api/cliente";
import { centavosDe, dataCurta, hojeIso, MESES, paraCampo, reais, type Mes } from "../../api/formato";
import { CampoDeValor } from "../../componentes/Campo";
import { Data } from "../../componentes/Data";
import { Dinheiro } from "../../componentes/Estado";
import { Folha } from "../../componentes/Folha";
import { MenuDeAcoes, type AcaoDoMenu } from "../../componentes/MenuDeAcoes";
import { Fichas } from "../../componentes/Selecao";
import { useAcao } from "../../useAcao";
import { ROTULO_CATEGORIA, ROTULO_STATUS, rotuloDaSituacao, tomDaSituacao } from "./rotulos";

const ACAO_DA_OCORRENCIA: Record<StatusTransacao, { rotulo: string; sucesso: string }> = {
  completed: { rotulo: "Pagar", sucesso: "Ocorrência paga." },
  cancelled: { rotulo: "Cancelar", sucesso: "Ocorrência cancelada." },
  refunded: { rotulo: "Estornar", sucesso: "Ocorrência estornada." },
  pending: { rotulo: "Desfazer", sucesso: "Voltou a pendente." },
};

/** Na parcela, a soma das pendentes; no empréstimo, o saldo do contrato. A mesma conta do web. */
function faltaPagar(entry: LancamentoVista) {
  if (entry.category === "loan") {
    const principal = Math.abs(entry.principalCents ?? Math.abs(entry.cents) * (entry.installments ?? 1));
    const pago = entry.occurrences
      .filter((item) => item.status === "completed" && item.kind !== "multa")
      .reduce((soma, item) => soma + Math.abs(item.paidCents ?? item.plannedCents), 0);
    return Math.max(principal - pago, 0);
  }
  return entry.occurrences.filter((item) => item.status === "pending").reduce((soma, item) => soma + Math.abs(item.plannedCents), 0);
}

function ultimoPagamento(entry: LancamentoVista) {
  const pagas = entry.occurrences.filter((item) => item.status === "completed" && item.paymentId);
  pagas.sort((a, b) => (b.paidOn ?? b.dueDate).localeCompare(a.paidOn ?? a.dueDate) || b.number - a.number);
  return pagas[0]?.paymentId ?? null;
}

/**
 * O lançamento aberto: valor, situação, ocorrências e tudo o que dá para fazer com ele.
 * Fixo: suspender ou cancelar o mês e mudar o valor. Parcela e empréstimo: pagar, quitar, desfazer e cancelar o restante.
 */
export function DetalheDoLancamento({
  entry,
  mes,
  aoFechar,
  aoEditar,
  aoMudar,
}: {
  entry: LancamentoVista | null;
  mes: Mes;
  aoFechar: () => void;
  aoEditar: (entry: LancamentoVista) => void;
  aoMudar: () => Promise<void>;
}) {
  const { ocupado, agir, confirmar } = useAcao();
  const [pagando, setPagando] = useState<"pagar" | "quitar" | null>(null);
  const [valorNovo, setValorNovo] = useState<string | null>(null);

  useEffect(() => {
    setPagando(null);
    setValorNovo(null);
  }, [entry?.id]);

  async function fazer(chave: string, acao: () => Promise<unknown>, sucesso: string) {
    if (await agir(chave, acao, sucesso)) await aoMudar();
  }

  if (!entry) return <Folha aberta={false} titulo="" aoFechar={aoFechar}>{null}</Folha>;

  const titulo = entry.name || entry.description;
  const sinal = entry.mode === "inflows" ? 1 : -1;
  const serie = entry.actions.series;
  const falta = serie ? faltaPagar(entry) : 0;
  const ultimo = serie ? ultimoPagamento(entry) : null;
  const ocorrencias = entry.occurrences.filter((item) => item.kind !== "multa" || item.status === "completed");

  return (
    <Folha aberta titulo={titulo} aoFechar={aoFechar}>
      <div className="cartao">
        <span className="etiqueta">
          {entry.groupName} · {entry.sessionName}
        </span>
        <span className="numero grande">
          <Dinheiro cents={sinal * Math.abs(entry.contractCents)} />
        </span>
        <div className="chips">
          <span className="chip">{ROTULO_CATEGORIA[entry.category]}</span>
          <span className={`chip ${tomDaSituacao(entry.situation)}`}>{rotuloDaSituacao(entry.situation)}</span>
          {entry.counterparty ? <span className="chip">{entry.counterparty}</span> : null}
        </div>
        {entry.nextDue ? <span className="fraco">Próximo vencimento: {dataCurta(entry.nextDue)}</span> : null}
        {serie ? <span className="fraco">Falta pagar: {reais(falta)}</span> : null}
        {entry.description && entry.name ? <span className="fraco">{entry.description}</span> : null}
        {entry.justification ? <span className="fraco">{entry.justification}</span> : null}
      </div>

      <div className="acoes-da-folha acoes-com-menu">
        <IonButton fill="outline" disabled={Boolean(ocupado)} onClick={() => aoEditar(entry)}>
          Editar
        </IonButton>
        <MenuDeAcoes
          titulo={titulo}
          rotulo="Mais ações do lançamento"
          desabilitado={Boolean(ocupado)}
          tamanho="default"
          acoes={[
            {
              texto: "Apagar o lançamento",
              icone: trashOutline,
              perigo: true,
              visivel: entry.actions.remove,
              aoEscolher: () =>
                confirmar(
                  "Apagar este lançamento?",
                  entry.synced ? "A linha do extrato volta para a Conferência." : "Não pode ser desfeito.",
                  "Apagar",
                  () =>
                    void agir("apagar", () => pedir(`/api/lancamentos/${entry.id}`, { method: "DELETE" }), "Lançamento apagado.").then(async (ok) => {
                      if (!ok) return;
                      aoFechar();
                      await aoMudar();
                    }),
                ),
            },
          ]}
        />
      </div>

      {entry.actions.fixedMonth ? (
        <section className="secao">
          <h2 className="etiqueta">Em {MESES[mes.mes - 1]} de {mes.ano}</h2>
          <div className="acoes-da-folha acoes-com-menu">
            <IonButton
              fill="outline"
              disabled={Boolean(ocupado)}
              onClick={() => void fazer("suspender", () => enviar(`/api/lancamentos/${entry.id}/fixo/suspender`, { year: mes.ano, month: mes.mes }), "Mês suspenso.")}
            >
              Suspender o mês
            </IonButton>
            <MenuDeAcoes
              titulo={`Em ${MESES[mes.mes - 1]} de ${mes.ano}`}
              rotulo="Mais ações do mês"
              desabilitado={Boolean(ocupado)}
              tamanho="default"
              acoes={[
                { texto: "Mudar o valor", icone: createOutline, aoEscolher: () => setValorNovo(paraCampo(entry.cents)) },
                {
                  texto: "Cancelar o mês",
                  icone: closeCircleOutline,
                  perigo: true,
                  aoEscolher: () =>
                    confirmar("Cancelar este mês?", "O valor sai deste mês. Os outros meses continuam.", "Cancelar o mês", () =>
                      void fazer("cancelar-mes", () => enviar(`/api/lancamentos/${entry.id}/fixo/cancelar`, { year: mes.ano, month: mes.mes }), "Mês cancelado."),
                    ),
                },
              ]}
            />
          </div>
          {valorNovo !== null ? (
            <div className="secao">
              <CampoDeValor rotulo="Valor novo" value={valorNovo} onMudar={setValorNovo} />
              <IonButton
                expand="block"
                className="principal"
                disabled={Boolean(ocupado)}
                onClick={() => {
                  const cents = centavosDe(valorNovo);
                  if (!cents) return;
                  void fazer("valor", () => enviar("/api/lancamentos/fixos/valor", { updates: [{ id: entry.id, cents }] }), "Valor atualizado.").then(() => setValorNovo(null));
                }}
              >
                Salvar o valor
              </IonButton>
            </div>
          ) : null}
        </section>
      ) : null}

      {serie ? (
        <section className="secao">
          <h2 className="etiqueta">{serie === "loan" ? "Empréstimo" : "Parcelas"}</h2>
          <div className="acoes-da-folha acoes-com-menu">
            {falta > 0 ? (
              <>
                <IonButton className="principal" disabled={Boolean(ocupado)} onClick={() => setPagando("pagar")}>
                  Pagar
                </IonButton>
                <IonButton fill="outline" disabled={Boolean(ocupado)} onClick={() => setPagando("quitar")}>
                  Quitar
                </IonButton>
              </>
            ) : null}
            <MenuDeAcoes
              titulo={serie === "loan" ? "Empréstimo" : "Parcelas"}
              rotulo={serie === "loan" ? "Mais ações do empréstimo" : "Mais ações das parcelas"}
              desabilitado={Boolean(ocupado)}
              tamanho="default"
              acoes={[
                {
                  texto: "Desfazer o último pagamento",
                  icone: arrowUndoOutline,
                  visivel: Boolean(ultimo),
                  aoEscolher: () => void fazer("desfazer", () => pedir(`/api/lancamentos/${entry.id}/pagamentos/${ultimo}`, { method: "DELETE" }), "Último pagamento desfeito."),
                },
                {
                  texto: "Cancelar o restante",
                  icone: closeCircleOutline,
                  perigo: true,
                  aoEscolher: () =>
                    confirmar("Cancelar o restante?", "As parcelas que faltam são canceladas. O que já foi pago continua.", "Cancelar o restante", () =>
                      void fazer(
                        "cancelar-serie",
                        () => enviar(`/api/lancamentos/${entry.id}/${serie === "loan" ? "emprestimo" : "parcelas"}/cancelar`, {}),
                        serie === "loan" ? "Empréstimo cancelado." : "Parcelas canceladas.",
                      ),
                    ),
                },
              ]}
            />
          </div>
          {pagando ? (
            <Pagamento
              key={`${entry.id}-${pagando}`}
              entry={entry}
              quitar={pagando === "quitar"}
              falta={falta}
              aoCancelar={() => setPagando(null)}
              aoPago={async () => {
                setPagando(null);
                await aoMudar();
              }}
            />
          ) : null}
        </section>
      ) : null}

      {ocorrencias.length > 1 || serie ? (
        <section className="secao">
          <h2 className="etiqueta">Ocorrências</h2>
          <div className="lista">
            {ocorrencias.map((item) => (
              <Ocorrencia
                key={`${item.number}-${item.kind ?? "parcela"}`}
                item={item}
                sinal={sinal}
                neste={dataContabil(item).startsWith(`${mes.ano}-${String(mes.mes).padStart(2, "0")}`) && item.status !== "cancelled"}
                ocupado={Boolean(ocupado)}
                aoGravar={async (corpo, sucesso) => {
                  const ok = await agir(`ocorrencia-${item.number}`, () => enviar(`/api/lancamentos/${entry.id}/ocorrencias/${item.number}`, corpo, "PATCH"), sucesso);
                  if (ok) await aoMudar();
                  return ok;
                }}
              />
            ))}
          </div>
        </section>
      ) : (
        <p className="fraco">Status: {ROTULO_STATUS[entry.status]}</p>
      )}
    </Folha>
  );
}

type CorpoDaOcorrencia = { status?: StatusTransacao; paidOn?: string; dueDate?: string; plannedCents?: number };

/**
 * Uma ocorrência: data, valor e situação, com as ações do status. A pendente que não veio do Google (`editable`)
 * abre o lápis: muda o vencimento e o valor só desta ocorrência, ou paga numa data que a pessoa escolhe.
 */
function Ocorrencia({
  item,
  sinal,
  neste,
  ocupado,
  aoGravar,
}: {
  item: OcorrenciaVista;
  sinal: number;
  /** É a ocorrência do mês que está aberto em Finanças. */
  neste: boolean;
  ocupado: boolean;
  aoGravar: (corpo: CorpoDaOcorrencia, sucesso: string) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [data, setData] = useState(item.dueDate);
  const [valor, setValor] = useState(paraCampo(item.plannedCents));
  const [paga, setPaga] = useState(hojeIso());
  const pago = item.status === "completed" && item.paidCents != null;
  const cents = pago ? item.paidCents! : item.plannedCents;
  const podePagar = item.next.includes("completed");

  async function salvar() {
    const novo = centavosDe(valor);
    const corpo: CorpoDaOcorrencia = {};
    if (data !== item.dueDate) corpo.dueDate = data;
    if (novo && novo !== Math.abs(item.plannedCents)) corpo.plannedCents = novo;
    if (Object.keys(corpo).length === 0) return setEditando(false);
    if (await aoGravar(corpo, "Ocorrência atualizada.")) setEditando(false);
  }

  return (
    <div className="ocorrencia-do-lancamento">
      <div className="linha ocorrencia">
        <div className="texto">
          <span>
            {item.parcel ? `${item.parcel}ª · ` : ""}
            {item.kind === "multa" ? "Multa e juros · " : ""}
            {dataCurta(pago && item.paidOn ? item.paidOn : item.dueDate)}
          </span>
          <span className="chips">
            <span className={`chip ${tomDaSituacao(item.situation)}`}>{rotuloDaSituacao(item.situation)}</span>
            {neste ? <span className="chip ia">Neste mês</span> : null}
            {pago && item.paidOn && item.paidOn !== item.dueDate ? <span className="chip">Venceu {dataCurta(item.dueDate)}</span> : null}
          </span>
        </div>
        <div className="lado-da-ocorrencia">
          <Dinheiro cents={sinal * Math.abs(cents)} />
          <div className="acoes-da-ocorrencia">
            {podePagar ? (
              <IonButton size="small" disabled={ocupado} onClick={() => void aoGravar({ status: "completed", paidOn: hojeIso() }, ACAO_DA_OCORRENCIA.completed.sucesso)}>
                {ACAO_DA_OCORRENCIA.completed.rotulo}
              </IonButton>
            ) : null}
            <MenuDeAcoes
              titulo={`Ocorrência de ${dataCurta(item.dueDate)}`}
              rotulo={`Mais ações da ocorrência de ${dataCurta(item.dueDate)}`}
              desabilitado={ocupado}
              acoes={[
                { texto: "Editar data e valor", icone: createOutline, visivel: item.editable, aoEscolher: () => setEditando((aberto) => !aberto) },
                ...item.next
                  .filter((status) => status !== "completed")
                  .map((status): AcaoDoMenu => ({
                    texto: ACAO_DA_OCORRENCIA[status].rotulo,
                    perigo: status === "cancelled" || status === "refunded",
                    aoEscolher: () => void aoGravar({ status }, ACAO_DA_OCORRENCIA[status].sucesso),
                  })),
              ]}
            />
          </div>
        </div>
      </div>
      {editando ? (
        <div className="cartao secao">
          <strong>Só esta ocorrência</strong>
          <Data rotulo="Vence em" valor={data} aoMudar={setData} />
          <CampoDeValor rotulo="Valor previsto" value={valor} onMudar={setValor} />
          <IonButton expand="block" className="principal" disabled={ocupado} onClick={() => void salvar()}>
            Salvar a ocorrência
          </IonButton>
          {podePagar ? (
            <>
              <Data rotulo="Pagar em" valor={paga} aoMudar={setPaga} />
              <IonButton expand="block" fill="outline" disabled={ocupado} onClick={() => void aoGravar({ status: "completed", paidOn: paga }, ACAO_DA_OCORRENCIA.completed.sucesso).then((ok) => ok && setEditando(false))}>
                Pagar nesta data
              </IonButton>
            </>
          ) : null}
          <IonButton fill="clear" onClick={() => setEditando(false)}>
            Fechar
          </IonButton>
        </div>
      ) : null}
    </div>
  );
}

/** Registra um pagamento com a data e o valor reais. Na parcela, a sobra pede: multa e juros, ou parte da próxima. */
function Pagamento({
  entry,
  quitar,
  falta,
  aoCancelar,
  aoPago,
}: {
  entry: LancamentoVista;
  quitar: boolean;
  falta: number;
  aoCancelar: () => void;
  aoPago: () => Promise<void>;
}) {
  const { ocupado, agir } = useAcao();
  const proxima = entry.occurrences.find((item) => item.status === "pending") ?? null;
  const [data, setData] = useState(hojeIso());
  const [valor, setValor] = useState(quitar ? paraCampo(falta) : proxima ? paraCampo(proxima.plannedCents) : "");
  const [diferenca, setDiferenca] = useState<DiferencaDoPagamento | "">("");
  const [erro, setErro] = useState("");
  const cents = centavosDe(valor);
  // Quantas parcelas o valor paga, de uma vez: duas do mesmo mês cabem num pagamento só. A pergunta da sobra só vem
  // quando sobra algo depois das parcelas inteiras e ainda há outra pendente.
  const parcela = entry.category === "installment";
  const pendentes = parcela ? pendentesDaSerie(entry.occurrences) : [];
  const plano = parcela && cents !== null ? planoDoPagamentoDeParcelas(pendentes, cents) : null;
  const pedeDiferenca = Boolean(plano?.pedeDiferenca);
  const frase = plano ? fraseDoPlanoDeParcelas(plano, reais) : "";
  const somaDe = (quantas: number) => pendentes.slice(0, quantas).reduce((total, item) => total + item, 0);
  const quantasPagas = plano && plano.sobraCents === 0 && plano.inteiras > 0 ? String(plano.inteiras) : "";

  async function pagar() {
    if (!cents) return setErro("Informe o valor.");
    if (pedeDiferenca && !diferenca) return setErro("Diga se a sobra é multa e juros ou parte da próxima parcela.");
    setErro("");
    const ok = await agir(
      "pagar",
      () => enviar(`/api/lancamentos/${entry.id}/pagamentos`, { date: data, cents, ...(pedeDiferenca && diferenca ? { diferenca } : {}) }),
      entry.category === "loan" ? "Pagamento registrado no empréstimo." : "Pagamento registrado nas parcelas.",
    );
    if (ok) await aoPago();
  }

  return (
    <div className="cartao secao">
      <strong>{quitar ? "Quitar" : "Registrar pagamento"}</strong>
      <span className="fraco">
        Falta {reais(falta)}
        {proxima ? `; a próxima parcela é ${reais(Math.abs(proxima.plannedCents))}.` : "."}
      </span>
      <Data rotulo="Data" valor={data} aoMudar={setData} />
      {parcela && pendentes.length > 1 ? (
        <div className="campo">
          <span className="etiqueta">Quantas parcelas pagar</span>
          <Fichas<string>
            rotulo="Quantas parcelas pagar"
            valor={quantasPagas}
            opcoes={[1, 2, 3].filter((quantas) => quantas <= pendentes.length).map((quantas) => ({ id: String(quantas), texto: quantas === 1 ? "1 parcela" : `${quantas} parcelas` }))}
            aoMudar={(quantas) => setValor(paraCampo(somaDe(Number(quantas))))}
          />
        </div>
      ) : null}
      <CampoDeValor rotulo="Valor pago" value={valor} onMudar={setValor} />
      {frase ? <span className="fraco">{frase}</span> : null}
      {pedeDiferenca ? (
        <div className="campo">
          <span className="etiqueta">{plano ? `Depois das parcelas inteiras sobram ${reais(plano.sobraCents)}. A sobra é` : "O que passou da parcela é"}</span>
          <Fichas
            rotulo="O que passou da parcela"
            valor={diferenca}
            opcoes={[
              { id: "multa" as const, texto: "Multa e juros" },
              { id: "proxima" as const, texto: "Parte da próxima" },
            ]}
            aoMudar={setDiferenca}
          />
        </div>
      ) : null}
      {erro ? <p className="erro">{erro}</p> : null}
      <div className="acoes-da-folha">
        <IonButton className="principal" disabled={Boolean(ocupado)} onClick={() => void pagar()}>
          {ocupado ? "Registrando" : "Registrar"}
        </IonButton>
        <IonButton fill="clear" onClick={aoCancelar}>
          Cancelar
        </IonButton>
      </div>
    </div>
  );
}
