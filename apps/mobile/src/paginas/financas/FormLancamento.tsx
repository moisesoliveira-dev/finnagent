import { IonButton } from "@ionic/react";
import {
  AJUSTES_DE_DIA_UTIL,
  MODOS_TRANSACAO,
  RECORRENCIAS,
  REGRA_SEM_AJUSTE,
  ROTULO_DO_AJUSTE,
  STATUS_TRANSACAO,
  TIPOS_DE_REGRA,
  aceitaDiaUtilDoMes,
  aceitaRegraDeVencimento,
  sessaoAceitaNoMes,
  type CategoriaTransacao,
  type ContasResposta,
  type FinancasVista,
  type GruposResposta,
  type LancamentoVista,
  type ModoTransacao,
  type Recorrencia,
  type RegraDeVencimento,
  type Sessao,
  type StatusTransacao,
} from "@finnagent/contracts";
import { calendarOutline, cashOutline, documentTextOutline, personOutline, pricetagOutline, repeatOutline, trendingUpOutline } from "ionicons/icons";
import { useEffect, useMemo, useState } from "react";
import { enviar, ler } from "../../api/cliente";
import { centavosDe, ehDataIso, hojeIso, paraCampo } from "../../api/formato";
import { AreaDeTexto, Campo } from "../../componentes/Campo";
import { Folha } from "../../componentes/Folha";
import { Fichas, Selecao } from "../../componentes/Selecao";
import { toque } from "../../haptico";
import { ROTULO_CATEGORIA, ROTULO_DA_REGRA, ROTULO_MODO, ROTULO_RECORRENCIA, ROTULO_STATUS } from "./rotulos";

type Rascunho = {
  sessionId: string;
  name: string;
  description: string;
  justification: string;
  date: string;
  mode: ModoTransacao;
  status: StatusTransacao;
  category: CategoriaTransacao;
  amount: string;
  installments: string;
  installmentNumber: string;
  dueDate: string;
  interestRate: string;
  counterparty: string;
  principal: string;
  nextDueDate: string;
  recurrence: Recorrencia;
  recurrenceInterval: string;
  accountId: string;
  dueRule: RegraDeVencimento;
};

type SessaoComGrupo = Sessao & { groupName: string };

// O Fixo começa pela única; o Acúmulo, pela fixa. A mesma escolha do web.
function categoriaDaSessao(sessao: SessaoComGrupo | undefined, atual?: CategoriaTransacao): CategoriaTransacao {
  const categorias = sessao?.categories;
  if (atual && categorias?.includes(atual)) return atual;
  if (sessao?.kind === "valor" && categorias?.includes("unique")) return "unique";
  if (categorias?.includes("fixed")) return "fixed";
  return categorias?.[0] ?? "unique";
}

function numero(texto: string) {
  if (texto.trim() === "") return null;
  const valor = Number(texto.replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}

function rascunhoDe(entry: LancamentoVista): Rascunho {
  return {
    sessionId: entry.sessionId,
    // O assistente grava o título em `name`; lançamentos antigos só têm `description`.
    name: entry.name || entry.description,
    description: entry.description,
    justification: entry.justification,
    date: entry.date,
    mode: entry.mode,
    status: entry.status,
    category: entry.category,
    amount: paraCampo(entry.contractCents),
    installments: String(entry.installments ?? 2),
    installmentNumber: String(entry.installmentNumber ?? 1),
    dueDate: entry.dueDate ?? entry.date,
    interestRate: entry.interestRate == null ? "" : String(entry.interestRate).replace(".", ","),
    counterparty: entry.counterparty ?? "",
    principal: entry.principalCents ? paraCampo(entry.principalCents) : "",
    nextDueDate: entry.nextDueDate ?? entry.date,
    recurrence: entry.recurrence ?? "monthly",
    recurrenceInterval: String(entry.recurrenceInterval ?? 1),
    accountId: entry.accountId ?? "",
    dueRule: entry.dueRule ?? REGRA_SEM_AJUSTE,
  };
}

function rascunhoNovo(data: string): Rascunho {
  return {
    sessionId: "",
    name: "",
    description: "",
    justification: "",
    date: data,
    mode: "outflows",
    status: "pending",
    category: "unique",
    amount: "",
    installments: "2",
    installmentNumber: "1",
    dueDate: data,
    interestRate: "",
    counterparty: "",
    principal: "",
    nextDueDate: data,
    recurrence: "monthly",
    recurrenceInterval: "1",
    accountId: "",
    dueRule: REGRA_SEM_AJUSTE,
  };
}

/**
 * Cria ou edita um lançamento: os mesmos campos e regras do web. A categoria da sessão decide o que aparece
 * (parcelas, empréstimo, recorrência) e o que já vem definido (entrada ou saída).
 */
export function FormLancamento({
  aberta,
  entry,
  vista,
  dataInicial,
  aoFechar,
  aoSalvo,
}: {
  aberta: boolean;
  entry: LancamentoVista | null;
  vista: FinancasVista | null;
  dataInicial?: string;
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  const [draft, setDraft] = useState<Rascunho>(() => rascunhoNovo(dataInicial ?? hojeIso()));
  const [sessoes, setSessoes] = useState<SessaoComGrupo[]>([]);
  const [contas, setContas] = useState<ContasResposta["accounts"]>([]);
  const [regraManual, setRegraManual] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const editando = entry !== null;

  // Ao abrir: as sessões abertas e as contas, e o rascunho do lançamento (ou um novo).
  useEffect(() => {
    if (!aberta) return;
    setErro("");
    setRegraManual(editando);
    const inicial = entry ? rascunhoDe(entry) : rascunhoNovo(dataInicial ?? hojeIso());
    setDraft(inicial);
    let vivo = true;
    void Promise.all([ler<GruposResposta>("/api/grupos"), ler<ContasResposta>("/api/contas").catch(() => ({ accounts: [], boxes: [] }))])
      .then(([grupos, resposta]) => {
        if (!vivo) return;
        const abertas = grupos.sessions
          .filter((sessao) => !sessao.endedAt || sessao.id === entry?.sessionId)
          .map((sessao) => ({ ...sessao, groupName: grupos.groups.find((grupo) => grupo.id === sessao.groupId)?.name ?? "" }));
        setSessoes(abertas);
        setContas(resposta.accounts);
        if (!entry) {
          const [ano, mes] = inicial.date.split("-").map(Number) as [number, number];
          const primeira = abertas.find((sessao) => sessaoAceitaNoMes(sessao, ano, mes));
          setDraft((atual) => ({ ...atual, sessionId: primeira?.id ?? "", category: categoriaDaSessao(primeira) }));
        }
      })
      .catch((error: unknown) => vivo && setErro(error instanceof Error ? error.message : "Não foi possível carregar as sessões."));
    return () => {
      vivo = false;
    };
  }, [aberta, entry, editando, dataInicial]);

  const sessao = sessoes.find((item) => item.id === draft.sessionId);
  const regra = vista?.rules[draft.category] ?? null;
  const modo = regra?.mode ?? draft.mode;
  const travado = Boolean(entry?.termsLocked);

  // Na criação, a sessão Fixo que já tem a transação do mês sai da lista; na edição, a dele fica.
  const opcoesDeSessao = useMemo(() => {
    const [ano, mes] = draft.date.split("-").map(Number) as [number, number];
    return sessoes
      .filter((item) => editando || !ehDataIso(draft.date) || sessaoAceitaNoMes(item, ano, mes))
      .map((item) => ({ id: item.id, texto: `${item.groupName} · ${item.name}` }));
  }, [sessoes, draft.date, editando]);

  const mudar = <K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) => setDraft((atual) => ({ ...atual, [campo]: valor }));

  async function salvar() {
    if (salvando) return;
    const cents = centavosDe(draft.amount);
    if (!draft.sessionId) return setErro(sessoes.length === 0 ? "Crie um grupo e uma sessão antes do lançamento." : "Escolha a sessão.");
    if (!draft.name.trim()) return setErro("Dê um nome ao lançamento.");
    if (!ehDataIso(draft.date)) return setErro("Informe a data.");
    if (!cents) return setErro("Informe o valor.");
    if (regra?.loan && draft.principal.trim() && centavosDe(draft.principal) === null) return setErro("Informe o total combinado em reais.");
    setSalvando(true);
    setErro("");
    const id = entry?.id ?? crypto.randomUUID();
    const comRegra = aceitaRegraDeVencimento(draft.category) && (regraManual || editando);
    try {
      await enviar(
        editando ? `/api/lancamentos/${id}` : "/api/lancamentos",
        {
          id,
          sessionId: draft.sessionId,
          name: draft.name.trim(),
          description: draft.description.trim(),
          justification: draft.justification.trim(),
          date: draft.date,
          mode: modo,
          status: draft.status,
          transactionType: regra?.transactionType ?? entry?.transactionType ?? "unusual",
          category: draft.category,
          priority: entry?.priority ?? "normal",
          cents,
          installments: numero(draft.installments),
          installmentNumber: numero(draft.installmentNumber),
          dueDate: draft.dueDate || null,
          interestRate: numero(draft.interestRate),
          counterparty: draft.counterparty.trim(),
          principalCents: draft.principal.trim() ? centavosDe(draft.principal) : null,
          nextDueDate: draft.nextDueDate || null,
          recurrence: draft.recurrence,
          recurrenceInterval: numero(draft.recurrenceInterval),
          accountId: draft.accountId || null,
          transfer: entry?.transfer ?? false,
          // Sem escolha da pessoa, vai null e o backend aplica o padrão das configurações.
          dueRule: comRegra ? { ...draft.dueRule, ordem: draft.dueRule.tipo === "dia_util" ? (draft.dueRule.ordem ?? 5) : null } : null,
        },
        editando ? "PATCH" : "POST",
      );
      // O status mudado na edição tem rota própria, como no web.
      if (editando && entry && draft.status !== entry.status && !entry.actions.series) {
        await enviar(`/api/lancamentos/${id}/status`, { status: draft.status }, "PATCH");
      }
      toque();
      aoSalvo();
    } catch (error) {
      toque(true);
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o lançamento.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Folha aberta={aberta} titulo={editando ? "Editar lançamento" : "Novo lançamento"} aoFechar={aoFechar}>
      <Selecao
        rotulo="Sessão"
        valor={draft.sessionId}
        vazio={opcoesDeSessao.length === 0 ? "Nenhuma sessão aberta" : undefined}
        opcoes={opcoesDeSessao}
        aoMudar={(sessionId) => {
          const escolhida = sessoes.find((item) => item.id === sessionId);
          setDraft((atual) => ({ ...atual, sessionId, category: categoriaDaSessao(escolhida, atual.category) }));
        }}
      />
      <Campo icone={pricetagOutline} rotulo="Nome" value={draft.name} onMudar={(valor) => mudar("name", valor)} placeholder="Aluguel, salário, mercado" maxLength={160} />
      <Campo icone={cashOutline} rotulo="Valor" value={draft.amount} onMudar={(valor) => mudar("amount", valor)} inputMode="decimal" placeholder="0,00" />
      <Campo icone={calendarOutline} rotulo="Data" type="date" value={draft.date} onMudar={(valor) => mudar("date", valor)} />

      <div className="campo">
        <span className="etiqueta">Categoria</span>
        <Fichas
          rotulo="Categoria"
          valor={draft.category}
          opcoes={(sessao?.categories ?? []).map((item) => ({ id: item, texto: ROTULO_CATEGORIA[item] }))}
          aoMudar={(category) => mudar("category", category)}
        />
      </div>

      {regra && regra.mode === null ? (
        <div className="campo">
          <span className="etiqueta">Movimento</span>
          <Fichas rotulo="Movimento" valor={draft.mode} opcoes={MODOS_TRANSACAO.map((item) => ({ id: item, texto: ROTULO_MODO[item] }))} aoMudar={(mode) => mudar("mode", mode)} />
        </div>
      ) : regra ? (
        <p className="fraco">{ROTULO_CATEGORIA[draft.category]} é sempre {ROTULO_MODO[modo].toLowerCase()}.</p>
      ) : null}

      {entry?.actions.series ? null : (
        <div className="campo">
          <span className="etiqueta">Status</span>
          <Fichas rotulo="Status" valor={draft.status} opcoes={STATUS_TRANSACAO.map((item) => ({ id: item, texto: ROTULO_STATUS[item] }))} aoMudar={(status) => mudar("status", status)} />
        </div>
      )}

      {regra?.installments ? (
        <div className="grade">
          <Campo icone={documentTextOutline} rotulo="Parcela atual" value={draft.installmentNumber} onMudar={(valor) => mudar("installmentNumber", valor)} inputMode="numeric" maxLength={3} disabled={travado} />
          <Campo icone={documentTextOutline} rotulo="Total de parcelas" value={draft.installments} onMudar={(valor) => mudar("installments", valor)} inputMode="numeric" maxLength={3} disabled={travado} />
        </div>
      ) : null}

      {regra?.loan ? (
        <>
          <Campo icone={personOutline} rotulo="De quem" value={draft.counterparty} onMudar={(valor) => mudar("counterparty", valor)} placeholder="Quem emprestou ou quem recebeu" maxLength={80} />
          <Campo icone={cashOutline} rotulo="Total combinado" value={draft.principal} onMudar={(valor) => mudar("principal", valor)} inputMode="decimal" placeholder="0,00" />
          <div className="grade">
            <Campo icone={calendarOutline} rotulo="Vence em" type="date" value={draft.dueDate} onMudar={(valor) => mudar("dueDate", valor)} />
            <Campo icone={trendingUpOutline} rotulo="Juros (%)" value={draft.interestRate} onMudar={(valor) => mudar("interestRate", valor)} inputMode="decimal" placeholder="0" />
          </div>
        </>
      ) : null}

      {regra?.recurrence ? (
        <>
          <Selecao rotulo="Recorrência" valor={draft.recurrence} opcoes={RECORRENCIAS.map((item) => ({ id: item, texto: ROTULO_RECORRENCIA[item] }))} aoMudar={(valor) => mudar("recurrence", valor as Recorrencia)} />
          <div className="grade">
            <Campo icone={repeatOutline} rotulo="A cada" value={draft.recurrenceInterval} onMudar={(valor) => mudar("recurrenceInterval", valor)} inputMode="numeric" maxLength={4} />
            <Campo icone={calendarOutline} rotulo="Próxima data" type="date" value={draft.nextDueDate} onMudar={(valor) => mudar("nextDueDate", valor)} />
          </div>
        </>
      ) : null}

      {aceitaRegraDeVencimento(draft.category) ? (
        <>
          <Selecao
            rotulo="Vencimento"
            valor={draft.dueRule.tipo}
            opcoes={TIPOS_DE_REGRA.filter((tipo) => tipo === "dia" || aceitaDiaUtilDoMes(draft.category, draft.recurrence)).map((tipo) => ({ id: tipo, texto: ROTULO_DA_REGRA[tipo] }))}
            aoMudar={(tipo) => {
              setRegraManual(true);
              mudar("dueRule", { ...draft.dueRule, tipo: tipo as RegraDeVencimento["tipo"], ordem: tipo === "dia_util" ? (draft.dueRule.ordem ?? 5) : null });
            }}
          />
          {draft.dueRule.tipo === "dia_util" ? (
            <Campo
              icone={calendarOutline}
              rotulo="Qual dia útil"
              value={String(draft.dueRule.ordem ?? 5)}
              onMudar={(valor) => {
                setRegraManual(true);
                mudar("dueRule", { ...draft.dueRule, ordem: Math.min(Math.max(Number(valor) || 1, 1), 23) });
              }}
              inputMode="numeric"
              maxLength={2}
            />
          ) : null}
          <Selecao
            rotulo="Se cair em fim de semana ou feriado"
            valor={draft.dueRule.ajuste}
            opcoes={AJUSTES_DE_DIA_UTIL.map((ajuste) => ({ id: ajuste, texto: ROTULO_DO_AJUSTE[ajuste] }))}
            aoMudar={(ajuste) => {
              setRegraManual(true);
              mudar("dueRule", { ...draft.dueRule, ajuste: ajuste as RegraDeVencimento["ajuste"] });
            }}
          />
        </>
      ) : null}

      {contas.length > 0 ? (
        <Selecao rotulo="Conta" valor={draft.accountId} vazio="Sem conta (só conta na sobra)" opcoes={contas.map((conta) => ({ id: conta.id, texto: conta.name }))} aoMudar={(valor) => mudar("accountId", valor)} />
      ) : null}

      <AreaDeTexto rotulo="Descrição" value={draft.description} onMudar={(valor) => mudar("description", valor)} linhas={2} maxLength={160} />
      <AreaDeTexto rotulo="Por que este valor existe" value={draft.justification} onMudar={(valor) => mudar("justification", valor)} linhas={2} maxLength={160} />

      {erro ? <p className="erro">{erro}</p> : null}
      <IonButton expand="block" className="principal" disabled={salvando} onClick={() => void salvar()}>
        {salvando ? "Salvando" : editando ? "Salvar" : "Lançar"}
      </IonButton>
    </Folha>
  );
}
