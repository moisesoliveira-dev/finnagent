import { IonButton, IonToggle } from "@ionic/react";
import {
  MOVIMENTOS_DA_CAIXINHA,
  ROTULO_DO_MOVIMENTO_DA_CAIXINHA,
  type AjusteDeSaldo,
  type Caixinha,
  type Conta,
  type Fatura,
  type Meta,
  type MovimentoDaCaixinha,
} from "@finnagent/contracts";
import { cardOutline, documentTextOutline, walletOutline } from "ionicons/icons";
import { useState } from "react";
import { enviar, pedir } from "../../api/cliente";
import { centavosDe, ehDataIso, hojeIso, MESES, paraCampo, reais } from "../../api/formato";
import { Campo, CampoDeValor } from "../../componentes/Campo";
import { Data } from "../../componentes/Data";
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
 * editar e excluir a conta, e criar, editar, movimentar ou excluir uma caixinha. Os mesmos pedidos do web.
 */
export function AcoesDaConta({
  acao,
  conta,
  contas,
  caixinhas,
  metas,
  saldoHoje,
  aoFechar,
  aoMudar,
  aoExcluida,
}: {
  acao: AcaoDaConta | null;
  conta: Conta;
  contas: Conta[];
  /** Todas as caixinhas, de todas as contas: a meta que já guarda numa delas não aparece na escolha. */
  caixinhas: Caixinha[];
  metas: Meta[];
  saldoHoje: number;
  aoFechar: () => void;
  aoMudar: () => Promise<void>;
  aoExcluida: () => void;
}) {
  const titulo =
    acao?.tipo === "conferir"
      ? conta.kind === "cartao"
        ? "Conferir a fatura"
        : "Conferir o saldo"
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
      {acao?.tipo === "caixinha" ? <FolhaDaCaixinha conta={conta} caixinha={acao.caixinha} caixinhas={caixinhas} metas={metas} aoPronto={pronto} /> : null}
    </Folha>
  );
}

/**
 * "A conta mostra R$ X no dia D": a diferença vira um ajuste lançado nesse dia. No cartão, a pessoa informa a fatura em
 * aberto, sem sinal: é o que o cartão deve, então o saldo vai sempre negativo, como no web.
 */
function Conferir({ conta, saldoHoje, aoPronto }: { conta: Conta; saldoHoje: number; aoPronto: () => Promise<void> }) {
  const { ocupado, agir, avisar } = useAcao();
  const cartao = conta.kind === "cartao";
  const [saldo, setSaldo] = useState(paraCampo(cartao ? Math.abs(saldoHoje) : saldoHoje));
  const [negativo, setNegativo] = useState(saldoHoje < 0);
  const [date, setDate] = useState(hojeIso());
  const [foraDaSobra, setForaDaSobra] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    const cents = centavosDe(saldo);
    if (cents === null) return setErro(cartao ? "Informe o valor da fatura." : "Informe o saldo em reais.");
    if (!ehDataIso(date)) return setErro("Informe a data.");
    setErro("");
    const saldoCents = cartao ? -Math.abs(cents) : negativo ? -cents : cents;
    let comoSaldoInicial = false;
    const ok = await agir("conferir", async () => {
      comoSaldoInicial = Boolean((await enviar<AjusteDeSaldo>(`/api/contas/${conta.id}/ajuste`, { saldoCents, date, foraDaSobra })).comoSaldoInicial);
    });
    if (!ok) return;
    avisar(comoSaldoInicial ? "O valor ficou como saldo inicial da conta: já estava lá, então não entra nas entradas do mês." : cartao ? "Fatura conferida." : "Saldo conferido.");
    await aoPronto();
  }

  return (
    <>
      <p className="fraco">
        {cartao
          ? "Diga a fatura em aberto que o app do cartão mostra, sem sinal. Se for diferente do Prumo, a diferença entra como um ajuste nesse dia. Na primeira vez que você confere, a diferença é o que já estava lá: vira o saldo inicial do cartão e não conta no mês."
          : "Diga quanto a conta mostra no banco. Se for diferente do Prumo, a diferença entra como um ajuste nesse dia. Na primeira vez que você confere, a diferença é o que já estava lá: vira o saldo inicial da conta e não conta no mês."}
      </p>
      <CampoDeValor rotulo={cartao ? "Fatura em aberto" : "Saldo no banco"} value={saldo} onMudar={setSaldo} />
      {cartao ? null : (
        <IonToggle checked={negativo} onIonChange={(evento) => setNegativo(evento.detail.checked)} labelPlacement="start" justify="space-between">
          Saldo negativo
        </IonToggle>
      )}
      <Data rotulo="Data" valor={date} aoMudar={setDate} />
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
      <CampoDeValor rotulo="Valor" value={valor} onMudar={setValor} />
      <Data rotulo="Data" valor={date} aoMudar={setDate} />
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
      <CampoDeValor rotulo="Valor" value={valor} onMudar={setValor} />
      <Data rotulo="Data" valor={date} aoMudar={setDate} />
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
          <CampoDeValor rotulo="Limite" value={limite} onMudar={setLimite} placeholder="Sem limite" />
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

/**
 * Nome, saldo inicial, o dia desse saldo e a meta ligada: o mesmo corpo na criação (POST) e na edição (PATCH), como no
 * web. A meta que já guarda em outra caixinha não aparece: cada meta guarda numa só.
 */
function FormDaCaixinha({
  conta,
  caixinha,
  caixinhas,
  metas,
  aoPronto,
  aoVoltar,
}: {
  conta: Conta;
  caixinha: Caixinha | null;
  caixinhas: Caixinha[];
  metas: Meta[];
  aoPronto: () => Promise<void>;
  aoVoltar?: () => void;
}) {
  const { ocupado, agir } = useAcao();
  const [name, setName] = useState(caixinha?.name ?? "");
  const [inicial, setInicial] = useState(caixinha ? paraCampo(caixinha.openingCents) : "");
  const [openingOn, setOpeningOn] = useState(caixinha ? (caixinha.openingOn ?? "") : hojeIso());
  const [goalId, setGoalId] = useState(caixinha?.goalId ?? "");
  const [erro, setErro] = useState("");
  const livres = metas.filter((meta) => meta.id === caixinha?.goalId || !caixinhas.some((item) => item.goalId === meta.id));

  async function salvar() {
    const openingCents = inicial.trim() ? centavosDe(inicial) : 0;
    if (!name.trim()) return setErro("Dê um nome à caixinha.");
    if (openingCents === null || openingCents < 0) return setErro("Informe o saldo inicial em reais.");
    if (openingOn && !ehDataIso(openingOn)) return setErro("Informe o dia do saldo inicial.");
    setErro("");
    const corpo = { name: name.trim(), openingCents, openingOn: openingOn || null, goalId: goalId || null };
    const feito = caixinha
      ? await agir("salvar", () => enviar(`/api/caixinhas/${caixinha.id}`, corpo, "PATCH"), "Caixinha salva.")
      : await agir("criar", () => enviar(`/api/contas/${conta.id}/caixinhas`, { id: crypto.randomUUID(), ...corpo }), "Caixinha criada.");
    if (feito) await aoPronto();
  }

  return (
    <>
      {caixinha ? null : <p className="fraco">Uma reserva dentro da {conta.name}, com o rendimento dela.</p>}
      <Campo icone={walletOutline} rotulo="Nome" value={name} onMudar={setName} placeholder="Reserva, viagem" maxLength={60} />
      <CampoDeValor rotulo="Saldo inicial" value={inicial} onMudar={setInicial} />
      <Data rotulo="Saldo em" valor={openingOn} aoMudar={setOpeningOn} limpavel />
      <p className="fraco">Só o que acontece a partir desse dia conta no saldo da caixinha. Vazio: tudo conta.</p>
      <Selecao rotulo="Meta" valor={goalId} vazio="Sem meta" opcoes={livres.map((meta) => ({ id: meta.id, texto: meta.name }))} aoMudar={setGoalId} />
      <p className="fraco">Com meta, o saldo da caixinha soma no guardado da meta, e o que a meta separa vira aplicação aqui.</p>
      {erro ? <p className="erro">{erro}</p> : null}
      <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void salvar()}>
        {caixinha ? "Salvar" : "Criar caixinha"}
      </IonButton>
      {aoVoltar ? (
        <IonButton expand="block" fill="clear" disabled={Boolean(ocupado)} onClick={aoVoltar}>
          Voltar
        </IonButton>
      ) : null}
    </>
  );
}

/** Uma caixinha nova, ou a existente: rendimento, aplicação, resgate, conferir o saldo, editar e excluir. */
function FolhaDaCaixinha({
  conta,
  caixinha,
  caixinhas,
  metas,
  aoPronto,
}: {
  conta: Conta;
  caixinha: Caixinha | null;
  caixinhas: Caixinha[];
  metas: Meta[];
  aoPronto: () => Promise<void>;
}) {
  const { ocupado, agir, confirmar, avisar } = useAcao();
  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState<MovimentoDaCaixinha>("aplicacao");
  const [valor, setValor] = useState("");
  const [perda, setPerda] = useState(false);
  const [date, setDate] = useState(hojeIso());
  const [saldo, setSaldo] = useState("");
  const [erro, setErro] = useState("");

  if (!caixinha) return <FormDaCaixinha conta={conta} caixinha={null} caixinhas={caixinhas} metas={metas} aoPronto={aoPronto} />;
  if (editando) return <FormDaCaixinha conta={conta} caixinha={caixinha} caixinhas={caixinhas} metas={metas} aoPronto={aoPronto} aoVoltar={() => setEditando(false)} />;

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
    let comoSaldoInicial = false;
    const ok = await agir("saldo", async () => {
      comoSaldoInicial = Boolean((await enviar<AjusteDeSaldo>(`/api/caixinhas/${atual.id}/saldo`, { saldoCents, date: hojeIso() })).comoSaldoInicial);
    });
    if (!ok) return;
    avisar(comoSaldoInicial ? "O valor ficou como saldo inicial da caixinha: já estava lá, então não é rendimento nem entra nas entradas do mês." : "Saldo da caixinha conferido.");
    await aoPronto();
  }

  return (
    <>
      <section className="secao">
        <h2 className="etiqueta">Movimento</h2>
        <Fichas rotulo="Movimento" valor={tipo} opcoes={MOVIMENTOS_DA_CAIXINHA.map((item) => ({ id: item, texto: ROTULO_DO_MOVIMENTO_DA_CAIXINHA[item] }))} aoMudar={setTipo} />
        <CampoDeValor rotulo="Valor" value={valor} onMudar={setValor} />
        {tipo === "rendimento" ? (
          <IonToggle checked={perda} onIonChange={(evento) => setPerda(evento.detail.checked)} labelPlacement="start" justify="space-between">
            Foi perda
          </IonToggle>
        ) : null}
        <Data rotulo="Data" valor={date} aoMudar={setDate} />
        <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void movimentar()}>
          Registrar
        </IonButton>
      </section>
      <section className="secao">
        <h2 className="etiqueta">Conferir o saldo</h2>
        <p className="fraco">Quanto a caixinha mostra hoje no banco: a diferença vira rendimento ou perda. Na primeira vez que você confere, a diferença é o que já estava lá: vira o saldo inicial da caixinha e não conta no mês.</p>
        <CampoDeValor rotulo="Saldo hoje" value={saldo} onMudar={setSaldo} />
        <IonButton expand="block" fill="outline" disabled={Boolean(ocupado)} onClick={() => void conferirSaldo()}>
          Conferir
        </IonButton>
      </section>
      {erro ? <p className="erro">{erro}</p> : null}
      <IonButton expand="block" fill="outline" disabled={Boolean(ocupado)} onClick={() => setEditando(true)}>
        Editar
      </IonButton>
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
