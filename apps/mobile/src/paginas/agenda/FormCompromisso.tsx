import { IonButton, IonToggle, useIonToast } from "@ionic/react";
import {
  AGENDAS,
  CATEGORIAS_COMPROMISSO,
  FUSO_PADRAO,
  type AgendaResposta,
  type CategoriaCompromisso,
  type Compromisso,
  type NomeAgenda,
} from "@finnagent/contracts";
import { locationOutline, pricetagOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { enviar } from "../../api/cliente";
import { ehDataIso } from "../../api/formato";
import { AreaDeTexto, Campo } from "../../componentes/Campo";
import { Data } from "../../componentes/Data";
import { Folha } from "../../componentes/Folha";
import { Hora } from "../../componentes/Hora";
import { Fichas, Selecao } from "../../componentes/Selecao";
import { toque } from "../../haptico";
import { ChecklistDoRascunho, type ItemDoRascunho } from "./ChecklistDoRascunho";

/**
 * Cria cada item do checklist como tarefa do compromisso, no dia dele e na ordem da lista, como o web
 * (criarChecklist em app/agenda/page.tsx). Devolve quantos itens não entraram: o compromisso já está criado.
 */
async function criarChecklist(appointmentId: string, date: string, itens: ItemDoRascunho[]) {
  let faltaram = 0;
  for (const item of itens) {
    try {
      await enviar("/api/tarefas", { id: crypto.randomUUID(), title: item.title, date, appointmentId });
    } catch {
      faltaram += 1;
    }
  }
  return faltaram;
}

export const ROTULO_DA_REPETICAO: Record<CategoriaCompromisso, string> = {
  fixed: "Só neste dia",
  periodical: "Todo mês",
  time: "Todo mês até uma data",
  weekly: "Toda semana",
  yearly: "Todo ano",
};

type Rascunho = {
  title: string;
  description: string;
  location: string;
  date: string;
  endDate: string;
  allDay: boolean;
  time: string;
  endTime: string;
  calendar: NomeAgenda;
  category: CategoriaCompromisso;
  entryId: string;
  sessionId: string;
  askSpending: boolean;
};

const iso = (ano: number, mes: number, dia: number) => `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

function rascunhoDe(item: Compromisso): Rascunho {
  // A repetição guarda o dia de origem: a edição parte dele, não do mês que está na tela.
  const data = iso(item.anchorYear ?? item.year, item.anchorMonth ?? item.month, item.anchorDay ?? item.day);
  return {
    title: item.title,
    description: item.description,
    location: item.location,
    date: data,
    endDate: item.endYear && item.endMonth && item.endDay ? iso(item.endYear, item.endMonth, item.endDay) : data,
    allDay: item.allDay,
    time: item.time ?? "",
    endTime: item.endTime ?? "",
    calendar: item.calendar,
    category: item.category,
    entryId: item.entryId ?? "",
    sessionId: item.sessionId ?? "",
    askSpending: item.askSpending,
  };
}

function rascunhoNovo(data: string): Rascunho {
  return {
    title: "",
    description: "",
    location: "",
    date: data,
    endDate: data,
    allDay: false,
    time: "09:00",
    endTime: "10:00",
    calendar: "Pessoal",
    category: "fixed",
    entryId: "",
    sessionId: "",
    askSpending: true,
  };
}

/** Cria ou edita um compromisso: os mesmos campos do web, com a sessão que guarda os gastos dele. */
export function FormCompromisso({
  aberta,
  compromisso,
  agenda,
  dataInicial,
  aoFechar,
  aoSalvo,
}: {
  aberta: boolean;
  compromisso: Compromisso | null;
  agenda: AgendaResposta | null;
  dataInicial: string;
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  const [draft, setDraft] = useState<Rascunho>(() => rascunhoNovo(dataInicial));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [checklist, setChecklist] = useState<ItemDoRascunho[]>([]);
  const [avisar] = useIonToast();

  useEffect(() => {
    if (!aberta) return;
    setErro("");
    setChecklist([]);
    setDraft(compromisso ? rascunhoDe(compromisso) : rascunhoNovo(dataInicial));
  }, [aberta, compromisso, dataInicial]);

  const mudar = <K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) => setDraft((atual) => ({ ...atual, [campo]: valor }));

  async function salvar() {
    if (salvando) return;
    if (!draft.title.trim()) return setErro("Dê um título ao compromisso.");
    if (!ehDataIso(draft.date)) return setErro("Informe o dia.");
    if (!draft.allDay && (!draft.time || !draft.endTime)) return setErro("Informe a hora inicial e a final.");
    if (draft.category === "time" && !ehDataIso(draft.endDate)) return setErro("Informe até quando repete.");
    const [year, month, day] = draft.date.split("-").map(Number) as [number, number, number];
    const fim = draft.category === "time" && ehDataIso(draft.endDate) ? draft.endDate.split("-").map(Number) : [];
    const pedido = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      allDay: draft.allDay,
      year,
      month,
      day,
      time: draft.allDay ? null : draft.time || null,
      endTime: draft.allDay ? null : draft.endTime || null,
      calendar: draft.calendar,
      timezone: agenda?.calendars.find((item) => item.name === draft.calendar)?.timezone ?? FUSO_PADRAO,
      category: draft.category,
      endYear: fim[0] ?? null,
      endMonth: fim[1] ?? null,
      endDay: fim[2] ?? null,
      entryId: draft.entryId || null,
      sessionId: draft.sessionId || null,
      askSpending: draft.askSpending,
    };
    setSalvando(true);
    setErro("");
    try {
      if (compromisso) await enviar(`/api/compromissos/${compromisso.id}`, pedido, "PATCH");
      else {
        const id = crypto.randomUUID();
        await enviar("/api/compromissos", { id, ...pedido });
        // O checklist entra depois do compromisso, no primeiro dia dele; o que falhar não desfaz o compromisso.
        const faltaram = await criarChecklist(id, draft.date, checklist);
        if (faltaram > 0) {
          void avisar({
            message: faltaram === 1 ? "1 item do checklist não entrou. Acrescente na aba Hoje." : `${faltaram} itens do checklist não entraram. Acrescente na aba Hoje.`,
            duration: 4200,
            position: "top",
            cssClass: "aviso-de-erro",
          });
        }
      }
      toque();
      aoSalvo();
    } catch (error) {
      toque(true);
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o compromisso.");
    } finally {
      setSalvando(false);
    }
  }

  // O lançamento ligado pode ser de outro mês: fica na lista mesmo que não venha neste.
  const lancamentos = agenda?.entries ?? [];
  const opcoesDeLancamento = [
    ...new Map(lancamentos.map((item) => [item.id, { id: item.id, texto: `${item.description} · ${item.groupName}` }])).values(),
  ];
  if (draft.entryId && !opcoesDeLancamento.some((item) => item.id === draft.entryId)) opcoesDeLancamento.unshift({ id: draft.entryId, texto: "O lançamento ligado" });

  return (
    <Folha
      aberta={aberta}
      titulo={compromisso ? "Editar compromisso" : "Novo compromisso"}
      aoFechar={aoFechar}
      rodape={
        <>
          {erro ? <p className="erro">{erro}</p> : null}
          <IonButton expand="block" className="principal" disabled={salvando} onClick={() => void salvar()}>
            {salvando ? "Salvando" : compromisso ? "Salvar" : "Marcar"}
          </IonButton>
        </>
      }
    >
      <Campo icone={pricetagOutline} rotulo="Título" value={draft.title} onMudar={(valor) => mudar("title", valor)} placeholder="Consulta, reunião, aniversário" maxLength={80} />
      <Data rotulo="Dia" valor={draft.date} aoMudar={(valor) => mudar("date", valor)} />

      <IonToggle checked={draft.allDay} onIonChange={(evento) => mudar("allDay", evento.detail.checked)} labelPlacement="start" justify="space-between">
        Dia todo
      </IonToggle>
      {draft.allDay ? null : (
        <div className="grade">
          <div className="campo">
            <span className="etiqueta">Começa</span>
            <Hora rotulo="Começa" valor={draft.time} aoMudar={(valor) => mudar("time", valor)} />
          </div>
          <div className="campo">
            <span className="etiqueta">Termina</span>
            <Hora rotulo="Termina" valor={draft.endTime} aoMudar={(valor) => mudar("endTime", valor)} />
          </div>
        </div>
      )}

      <Selecao
        rotulo="Repete"
        valor={draft.category}
        opcoes={CATEGORIAS_COMPROMISSO.map((item) => ({ id: item, texto: ROTULO_DA_REPETICAO[item] }))}
        aoMudar={(valor) => mudar("category", valor as CategoriaCompromisso)}
      />
      {draft.category === "time" ? <Data rotulo="Até" valor={draft.endDate} aoMudar={(valor) => mudar("endDate", valor)} /> : null}

      <div className="campo">
        <span className="etiqueta">Agenda</span>
        <Fichas rotulo="Agenda" valor={draft.calendar} opcoes={AGENDAS.map((item) => ({ id: item, texto: item }))} aoMudar={(valor) => mudar("calendar", valor)} />
      </div>
      <Campo icone={locationOutline} rotulo="Local" value={draft.location} onMudar={(valor) => mudar("location", valor)} maxLength={160} />

      {agenda && agenda.sessions.length > 0 ? (
        <Selecao rotulo="Sessão dos gastos" valor={draft.sessionId} vazio="Sem sessão de gastos" opcoes={agenda.sessions.map((item) => ({ id: item.id, texto: item.label }))} aoMudar={(valor) => mudar("sessionId", valor)} />
      ) : null}
      <IonToggle checked={draft.askSpending} onIonChange={(evento) => mudar("askSpending", evento.detail.checked)} labelPlacement="start" justify="space-between">
        Perguntar se teve gasto depois
      </IonToggle>
      {opcoesDeLancamento.length > 0 ? (
        <Selecao rotulo="Lançamento ligado" valor={draft.entryId} vazio="Nenhum" opcoes={opcoesDeLancamento} aoMudar={(valor) => mudar("entryId", valor)} />
      ) : null}

      {compromisso ? null : <ChecklistDoRascunho itens={checklist} repete={draft.category !== "fixed"} aoMudar={setChecklist} />}

      <AreaDeTexto rotulo="Descrição" value={draft.description} onMudar={(valor) => mudar("description", valor)} linhas={2} maxLength={160} />
    </Folha>
  );
}
