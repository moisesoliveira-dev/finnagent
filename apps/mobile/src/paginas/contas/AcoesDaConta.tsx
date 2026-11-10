import { IonButton, IonToggle } from "@ionic/react";
import {
  MOVIMENTOS_DA_CAIXINHA,
  ROTULO_DO_MOVIMENTO_DA_CAIXINHA,
  type Caixinha,
  type Conta,
  type Fatura,
  type MovimentoDaCaixinha,
} from "@finnagent/contracts";
import { calendarOutline, cardOutline, cashOutline, documentTextOutline, walletOutline } from "ionicons/icons";
import { useState } from "react";
import { enviar, pedir } from "../../api/cliente";
import { centavosDe, ehDataIso, hojeIso, MESES, paraCampo, reais } from "../../api/formato";
import { Campo } from "../../componentes/Campo";
import { Folha } from "../../componentes/Folha";
import { Fichas, Selecao } from "../../componentes/Selecao";
import { useAcao } from "../../useAcao";

/** Qual folha está aberta no detalhe da conta. */
export type AcaoDaConta =
  | { tipo: "conferir" }
  | { tipo: "transferir" }
  | { tipo: "editar" }
  | { tipo: "pagar"; fatura: Fatura }
  | { tipo: "caixinha"; caixinha: Caixinha | null };

const nomeDoMes = (month: string) => `${MESES[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;

/**
 * As ações da conta, uma folha por vez: conferir o saldo (o ajuste), transferir, pagar a fatura do cartão,
 * editar e excluir a conta, e criar, movimentar ou excluir uma caixinha. Os mesmos pedidos do web.
 */
export function AcoesDaConta({
  acao,
  conta,
  contas,
  saldoHoje,
  aoFechar,
  aoMudar,
  aoExcluida,
}: {
  acao: AcaoDaConta | null;
  conta: Conta;
  contas: Conta[];
  saldoHoje: number;
  aoFechar: () => void;
  aoMudar: () => Promise<void>;
  aoExcluida: () => void;
}) {
  const titulo =
    acao?.tipo === "conferir"
      ? "Conferir o saldo"
      : acao?.tipo === "transferir"
        ? "Transferir"
        : acao?.tipo === "editar"
          ? `Editar ${conta.name}`
          : acao?.tipo === "pagar"
            ? `Pagar a fatura de ${nomeDoMes(acao.fatura.month)}`
            : acao?.tipo === "caixinha"
              ? (acao.caixinha?.name ?? "Nova caixinha")
              : "";
  const pronto = async () => {
    aoFechar();
    await aoMudar();
  };
  return (
    <Folha aberta={acao !== null} titulo={titulo} aoFechar={aoFechar}>
      {acao?.tipo === "conferir" ? <Conferir conta={conta} saldoHoje={saldoHoje} aoPronto={pronto} /> : null}
      {acao?.tipo === "transferir" ? <Transferir conta={conta} contas={contas} aoPronto={pronto} /> : null}
      {acao?.tipo === "editar" ? <Editar conta={conta} aoPronto={pronto} aoExcluida={aoExcluida} /> : null}
      {acao?.tipo === "pagar" ? <PagarFatura cartao={conta} fatura={acao.fatura} contas={contas} aoPronto={pronto} /> : null}
      {acao?.tipo === "caixinha" ? <FolhaDaCaixinha conta={conta} caixinha={acao.caixinha} aoPronto={pronto} /> : null}
    </Folha>
  );
}

/** "A conta mostra R$ X no dia D": a diferença vira um ajuste lançado nesse dia. */
function Conferir({ conta, saldoHoje, aoPronto }: { conta: Conta; saldoHoje: number; aoPronto: () => Promise<void> }) {
  const { ocupado, agir } = useAcao();
  const [saldo, setSaldo] = useState(paraCampo(saldoHoje));
  const [negativo, setNegativo] = useState(saldoHoje < 0);
  const [date, setDate] = useState(hojeIso());
  const [foraDaSobra, setForaDaSobra] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    const cents = centavosDe(saldo);
    if (cents === null) return setErro("Informe o saldo em reais.");
    if (!ehDataIso(date)) return setErro("Informe a data.");
    setErro("");
    const saldoCents = negativo ? -cents : cents;
    if (await agir("conferir", () => enviar(`/api/contas/${conta.id}/ajuste`, { saldoCents, date, foraDaSobra }), "Saldo conferido.")) await aoPronto();
  }

  return (
    <>
      <p className="fraco">Diga quanto a {conta.kind === "cartao" ? "fatura" : "conta"} mostra no banco. Se for diferente do Prumo, a diferença entra como um ajuste nesse dia.</p>
      <Campo icone={cashOutline} rotulo="Saldo no banco" value={saldo} onMudar={setSaldo} inputMode="decimal" />
      <IonToggle checked={negativo} onIonChange={(evento) => setNegativo(evento.detail.checked)} labelPlacement="start" justify="space-between">
        Saldo negativo
      </IonToggle>
      <Campo icone={calendarOutline} rotulo="Data" type="date" value={date} onMudar={setDate} />
      <IonToggle checked={foraDaSobra} onIonChange={(evento) => setForaDaSobra(evento.detail.checked)} labelPlacement="start" justify="space-between">
        Não contar na sobra do mês
      </IonToggle>
      <p className="fraco">Marque se a diferença não é dinheiro que entrou ou saiu de verdade, como um erro de registro antigo.</p>
      {erro ? <p className="erro">{erro}</p> : null}
      <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void salvar()}>
        Conferir
      </IonButton>
    </>
  );
}

/** Dinheiro da própria pessoa de uma conta para outra: muda os saldos, não a sobra. */
function Transferir({ conta, contas, aoPronto }: { conta: Conta; contas: Conta[]; aoPronto: () => Promise<void> }) {
  const { ocupado, agir } = useAcao();
  const outras = contas.filter((item) => item.id !== conta.id);
  const [sentido, setSentido] = useState<"sai" | "entra">("sai");
  const [outra, setOutra] = useState(outras[0]?.id ?? "");
  const [valor, setValor] = useState("");
  const [date, setDate] = useState(hojeIso());
  const [note, setNote] = useState("");
  const [erro, setErro] = useState("");

  async function salvar() {
    const cents = centavosDe(valor);
    if (!outra) return setErro("Escolha a outra conta.");
    if (!cents) return setErro("Informe o valor.");
    if (!ehDataIso(date)) return setErro("Informe a data.");
    setErro("");
    const corpo = {
      fromAccountId: sentido === "sai" ? conta.id : outra,
      toAccountId: sentido === "sai" ? outra : conta.id,
      cents,
      date,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    if (await agir("transferir", () => enviar("/api/contas/transferencias", corpo), "Transferência registrada.")) await aoPronto();
  }

  if (outras.length === 0) return <p className="fraco">Cadastre outra conta para transferir entre elas.</p>;
  return (
    <>
      <div className="campo">
        <span className="etiqueta">Sentido</span>
        <Fichas
          rotulo="Sentido"
          valor={sentido}
          opcoes={[
            { id: "sai" as const, texto: `Sai de ${conta.name}` },
            { id: "entra" as const, texto: `Entra em ${conta.name}` },
          ]}
          aoMudar={setSentido}
        />
      </div>
      <Selecao rotulo={sentido === "sai" ? "Para" : "De"} valor={outra} opcoes={outras.map((item) => ({ id: item.id, texto: item.name }))} aoMudar={setOutra} />
      <Campo icone={cashOutline} rotulo="Valor" value={valor} onMudar={setValor} inputMode="decimal" placeholder="0,00" />
      <Campo icone={calendarOutline} rotulo="Data" type="date" value={date} onMudar={setDate} />
      <Campo icone={documentTextOutline} rotulo="Observação (opcional)" value={note} onMudar={setNote} maxLength={160} />
      {erro ? <p className="erro">{erro}</p> : null}
      <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void salvar()}>
        Transferir
      </IonButton>
    </>
  );
}

/** Paga a fatura do cartão a partir de uma conta: vira uma transferência da conta para o cartão. */
function PagarFatura({ cartao, fatura, contas, aoPronto }: { cartao: Conta; fatura: Fatura; contas: Conta[]; aoPronto: () => Promise<void> }) {
  const { ocupado, agir } = useAcao();
  const origens = contas.filter((item) => item.kind !== "cartao");
  const [origem, setOrigem] = useState(origens[0]?.id ?? "");
  const [valor, setValor] = useState(paraCampo(Math.max(fatura.totalCents - fatura.paidCents, 0)));
  const [date, setDate] = useState(hojeIso());
  const [erro, setErro] = useState("");

  async function salvar() {
    const cents = centavosDe(valor);
    if (!origem) return setErro("Escolha a conta de onde sai o pagamento.");
    if (!cents) return setErro("Informe o valor.");
    if (!ehDataIso(date)) return setErro("Informe a data.");
    setErro("");
    if (await agir("pagar", () => enviar(`/api/contas/${cartao.id}/pagar-fatura`, { fromAccountId: origem, cents, date, month: fatura.month }), "Pagamento da fatura registrado.")) await aoPronto();
  }

  if (origens.length === 0) return <p className="fraco">Cadastre a conta de onde sai o pagamento.</p>;
  return (
    <>
      <p className="fraco">
        Total {reais(fatura.totalCents)}
        {fatura.paidCents > 0 ? `, já pago ${reais(fatura.paidCents)}` : ""}.
      </p>
      <Selecao rotulo="Sai da conta" valor={origem} opcoes={origens.map((item) => ({ id: item.id, texto: item.name }))} aoMudar={setOrigem} />
      <Campo icone={cashOutline} rotulo="Valor" value={valor} onMudar={setValor} inputMode="decimal" />
      <Campo icone={calendarOutline} rotulo="Data" type="date" value={date} onMudar={setDate} />
      {erro ? <p className="erro">{erro}</p> : null}
      <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void salvar()}>
        Pagar
      </IonButton>
    </>
  );
}

/** Nome, e no cartão o fechamento, o vencimento e o limite. O saldo inicial muda pela conferência. */
function Editar({ conta, aoPronto, aoExcluida }: { conta: Conta; aoPronto: () => Promise<void>; aoExcluida: () => void }) {
  const { ocupado, agir, confirmar } = useAcao();
  const cartao = conta.kind === "cartao";
  const [name, setName] = useState(conta.name);
  const [fecha, setFecha] = useState(conta.closingDay ? String(conta.closingDay) : "");
  const [vence, setVence] = useState(conta.dueDay ? String(conta.dueDay) : "");
  const [limite, setLimite] = useState(conta.limitCents ? paraCampo(conta.limitCents) : "");
  const [erro, setErro] = useState("");

  async function salvar() {
    if (!name.trim()) return setErro("Dê um nome à conta.");
    const dia = (texto: string) => (texto.trim() ? Number(texto) : null);
    for (const valor of [fecha, vence]) if (cartao && valor.trim() && !(Number(valor) >= 1 && Number(valor) <= 28)) return setErro("Fechamento e vencimento vão de 1 a 28.");
    const limitCents = cartao && limite.trim() ? centavosDe(limite) : null;
    if (cartao && limite.trim() && limitCents === null) return setErro("Informe o limite em reais.");
    setErro("");
    const corpo = {
      name: name.trim(),
      kind: conta.kind,
      openingCents: conta.openingCents,
      ...(cartao ? { closingDay: dia(fecha), dueDay: dia(vence), limitCents } : {}),
    };
    if (await agir("editar", () => enviar(`/api/contas/${conta.id}`, corpo, "PATCH"), "Conta salva.")) await aoPronto();
  }

  return (
    <>
      <Campo icone={walletOutline} rotulo="Nome" value={name} onMudar={setName} maxLength={80} />
      {cartao ? (
        <>
          <div className="grade">
            <Campo icone={cardOutline} rotulo="Fecha dia" value={fecha} onMudar={setFecha} inputMode="numeric" maxLength={2} />
            <Campo icone={cardOutline} rotulo="Vence dia" value={vence} onMudar={setVence} inputMode="numeric" maxLength={2} />
          </div>
          <Campo icone={cashOutline} rotulo="Limite" value={limite} onMudar={setLimite} inputMode="decimal" placeholder="Sem limite" />
        </>
      ) : null}
      {erro ? <p className="erro">{erro}</p> : null}
      <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void salvar()}>
        Salvar
      </IonButton>
      <IonButton
        expand="block"
        fill="clear"
        color="danger"
        disabled={Boolean(ocupado)}
        onClick={() =>
          confirmar(`Excluir a conta ${conta.name}?`, "Os lançamentos ligados a ela continuam, mas ficam sem conta. Não pode ser desfeito.", "Excluir", () =>
            void agir("excluir", () => pedir(`/api/contas/${conta.id}`, { method: "DELETE" }), "Conta excluída.").then((ok) => ok && aoExcluida()),
          )
        }
      >
        Excluir a conta
      </IonButton>
    </>
  );
}

/** Uma caixinha nova, ou a existente: rendimento, aplicação, resgate, conferir o saldo e excluir. */
function FolhaDaCaixinha({ conta, caixinha, aoPronto }: { conta: Conta; caixinha: Caixinha | null; aoPronto: () => Promise<void> }) {
  const { ocupado, agir, confirmar } = useAcao();
  const [name, setName] = useState("");
  const [inicial, setInicial] = useState("");
  const [tipo, setTipo] = useState<MovimentoDaCaixinha>("aplicacao");
  const [valor, setValor] = useState("");
  const [perda, setPerda] = useState(false);
  const [date, setDate] = useState(hojeIso());
  const [saldo, setSaldo] = useState("");
  const [erro, setErro] = useState("");

  if (!caixinha) {
    const criar = async () => {
      const openingCents = inicial.trim() ? centavosDe(inicial) : 0;
      if (!name.trim()) return setErro("Dê um nome à caixinha.");
      if (openingCents === null) return setErro("Informe o valor em reais.");
      setErro("");
      if (await agir("criar", () => enviar(`/api/contas/${conta.id}/caixinhas`, { id: crypto.randomUUID(), name: name.trim(), openingCents, goalId: null }), "Caixinha criada.")) await aoPronto();
    };
    return (
      <>
        <p className="fraco">Uma reserva dentro da {conta.name}, com o rendimento dela.</p>
        <Campo icone={walletOutline} rotulo="Nome" value={name} onMudar={setName} placeholder="Reserva, viagem" maxLength={60} />
        <Campo icone={cashOutline} rotulo="Quanto tem hoje" value={inicial} onMudar={setInicial} inputMode="decimal" placeholder="0,00" />
        {erro ? <p className="erro">{erro}</p> : null}
        <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void criar()}>
          Criar caixinha
        </IonButton>
      </>
    );
  }

  const atual = caixinha;
  async function movimentar() {
    const cents = centavosDe(valor);
    if (!cents) return setErro("Informe o valor.");
    if (!ehDataIso(date)) return setErro("Informe a data.");
    setErro("");
    const comSinal = tipo === "rendimento" && perda ? -cents : cents;
    if (await agir("movimento", () => enviar(`/api/caixinhas/${atual.id}/movimentos`, { tipo, cents: comSinal, date }), `${ROTULO_DO_MOVIMENTO_DA_CAIXINHA[tipo]} registrado.`)) await aoPronto();
  }

  async function conferirSaldo() {
    const saldoCents = centavosDe(saldo);
    if (saldoCents === null) return setErro("Informe o saldo em reais.");
    setErro("");
    if (await agir("saldo", () => enviar(`/api/caixinhas/${atual.id}/saldo`, { saldoCents, date: hojeIso() }), "Saldo da caixinha conferido.")) await aoPronto();
  }

  return (
    <>
      <section className="secao">
        <h2 className="etiqueta">Movimento</h2>
        <Fichas rotulo="Movimento" valor={tipo} opcoes={MOVIMENTOS_DA_CAIXINHA.map((item) => ({ id: item, texto: ROTULO_DO_MOVIMENTO_DA_CAIXINHA[item] }))} aoMudar={setTipo} />
        <Campo icone={cashOutline} rotulo="Valor" value={valor} onMudar={setValor} inputMode="decimal" placeholder="0,00" />
        {tipo === "rendimento" ? (
          <IonToggle checked={perda} onIonChange={(evento) => setPerda(evento.detail.checked)} labelPlacement="start" justify="space-between">
            Foi perda
          </IonToggle>
        ) : null}
        <Campo icone={calendarOutline} rotulo="Data" type="date" value={date} onMudar={setDate} />
        <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void movimentar()}>
          Registrar
        </IonButton>
      </section>
      <section className="secao">
        <h2 className="etiqueta">Conferir o saldo</h2>
        <p className="fraco">Quanto a caixinha mostra hoje no banco: a diferença vira rendimento ou perda.</p>
        <Campo icone={cashOutline} rotulo="Saldo hoje" value={saldo} onMudar={setSaldo} inputMode="decimal" placeholder="0,00" />
        <IonButton expand="block" fill="outline" disabled={Boolean(ocupado)} onClick={() => void conferirSaldo()}>
          Conferir
        </IonButton>
      </section>
      {erro ? <p className="erro">{erro}</p> : null}
      <IonButton
        expand="block"
        fill="clear"
        color="danger"
        disabled={Boolean(ocupado)}
        onClick={() =>
          confirmar(`Excluir a caixinha ${atual.name}?`, "O rendimento, as aplicações e os resgates já lançados continuam na sessão dela, no grupo Conta. Não pode ser desfeito.", "Excluir caixinha", () =>
            void agir("excluir", () => pedir(`/api/caixinhas/${atual.id}`, { method: "DELETE" }), `Caixinha ${atual.name} excluída.`).then((ok) => ok && void aoPronto()),
          )
        }
      >
        Excluir a caixinha
      </IonButton>
    </>
  );
}
