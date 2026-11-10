import { IonButton } from "@ionic/react";
import type { DiferencaDoPagamento, LancamentoVista, OcorrenciaVista, StatusTransacao } from "@finnagent/contracts";
import { calendarOutline, cashOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { enviar, pedir } from "../../api/cliente";
import { centavosDe, dataCurta, hojeIso, MESES, paraCampo, reais, type Mes } from "../../api/formato";
import { Campo } from "../../componentes/Campo";
import { Dinheiro } from "../../componentes/Estado";
import { Folha } from "../../componentes/Folha";
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

      <div className="acoes-da-folha">
        <IonButton fill="outline" disabled={Boolean(ocupado)} onClick={() => aoEditar(entry)}>
          Editar
        </IonButton>
        {entry.actions.remove ? (
          <IonButton
            fill="outline"
            color="danger"
            disabled={Boolean(ocupado)}
            onClick={() =>
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
              )
            }
          >
            Apagar
          </IonButton>
        ) : null}
      </div>

      {entry.actions.fixedMonth ? (
        <section className="secao">
          <h2 className="etiqueta">Em {MESES[mes.mes - 1]} de {mes.ano}</h2>
          <div className="acoes-da-folha">
            <IonButton
              fill="outline"
              disabled={Boolean(ocupado)}
              onClick={() => void fazer("suspender", () => enviar(`/api/lancamentos/${entry.id}/fixo/suspender`, { year: mes.ano, month: mes.mes }), "Mês suspenso.")}
            >
              Suspender o mês
            </IonButton>
            <IonButton
              fill="outline"
              color="danger"
              disabled={Boolean(ocupado)}
              onClick={() =>
                confirmar("Cancelar este mês?", "O valor sai deste mês. Os outros meses continuam.", "Cancelar o mês", () =>
                  void fazer("cancelar-mes", () => enviar(`/api/lancamentos/${entry.id}/fixo/cancelar`, { year: mes.ano, month: mes.mes }), "Mês cancelado."),
                )
              }
            >
              Cancelar o mês
            </IonButton>
            <IonButton fill="clear" disabled={Boolean(ocupado)} onClick={() => setValorNovo(paraCampo(entry.cents))}>
              Mudar o valor
            </IonButton>
          </div>
          {valorNovo !== null ? (
            <div className="secao">
              <Campo icone={cashOutline} rotulo="Valor novo" value={valorNovo} onMudar={setValorNovo} inputMode="decimal" />
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
          <div className="acoes-da-folha">
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
            {ultimo ? (
              <IonButton
                fill="clear"
                disabled={Boolean(ocupado)}
                onClick={() => void fazer("desfazer", () => pedir(`/api/lancamentos/${entry.id}/pagamentos/${ultimo}`, { method: "DELETE" }), "Último pagamento desfeito.")}
              >
                Desfazer o último
              </IonButton>
            ) : null}
            <IonButton
              fill="clear"
              color="danger"
              disabled={Boolean(ocupado)}
              onClick={() =>
                confirmar("Cancelar o restante?", "As parcelas que faltam são canceladas. O que já foi pago continua.", "Cancelar o restante", () =>
                  void fazer(
                    "cancelar-serie",
                    () => enviar(`/api/lancamentos/${entry.id}/${serie === "loan" ? "emprestimo" : "parcelas"}/cancelar`, {}),
                    serie === "loan" ? "Empréstimo cancelado." : "Parcelas canceladas.",
                  ),
                )
              }
            >
              Cancelar o restante
            </IonButton>
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
                ocupado={Boolean(ocupado)}
                aoMudar={(status) =>
                  void fazer(
                    `ocorrencia-${item.number}`,
                    () => enviar(`/api/lancamentos/${entry.id}/ocorrencias/${item.number}`, status === "completed" ? { status, paidOn: hojeIso() } : { status }, "PATCH"),
                    ACAO_DA_OCORRENCIA[status].sucesso,
                  )
                }
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

function Ocorrencia({ item, sinal, ocupado, aoMudar }: { item: OcorrenciaVista; sinal: number; ocupado: boolean; aoMudar: (status: StatusTransacao) => void }) {
  const valor = item.status === "completed" && item.paidCents != null ? item.paidCents : item.plannedCents;
  return (
    <div className="linha ocorrencia">
      <div className="texto">
        <span>
          {item.parcel ? `${item.parcel}ª · ` : ""}
          {item.kind === "multa" ? "Multa e juros · " : ""}
          {dataCurta(item.status === "completed" && item.paidOn ? item.paidOn : item.dueDate)}
        </span>
        <span className={`chip ${tomDaSituacao(item.situation)}`} style={{ justifySelf: "start" }}>
          {rotuloDaSituacao(item.situation)}
        </span>
      </div>
      <div className="lado-da-ocorrencia">
        <Dinheiro cents={sinal * Math.abs(valor)} />
        {item.next.length > 0 ? (
          <div className="acoes-da-ocorrencia">
            {item.next.map((status) => (
              <IonButton key={status} size="small" fill={status === "completed" ? "solid" : "clear"} color={status === "cancelled" || status === "refunded" ? "danger" : undefined} disabled={ocupado} onClick={() => aoMudar(status)}>
                {ACAO_DA_OCORRENCIA[status].rotulo}
              </IonButton>
            ))}
          </div>
        ) : null}
      </div>
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
  const pedeDiferenca = entry.category === "installment" && cents !== null && proxima !== null && cents > Math.abs(proxima.plannedCents) && cents < falta;

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
      <Campo icone={calendarOutline} rotulo="Data" type="date" value={data} onMudar={setData} />
      <Campo icone={cashOutline} rotulo="Valor pago" value={valor} onMudar={setValor} inputMode="decimal" />
      {pedeDiferenca ? (
        <div className="campo">
          <span className="etiqueta">O que passou da parcela é</span>
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
