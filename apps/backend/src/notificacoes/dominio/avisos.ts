import {
  AVISO_DO_LIMITE_EM,
  emSilencio,
  ocorrenciasDoLancamento,
  type CanalDeNotificacao,
  type Compromisso,
  type DestinoDaNotificacao,
  type Lancamento,
  type MetasResposta,
  type PerguntaDeGasto,
  type PreferenciasDeNotificacao,
  type StatusExtrato,
  type TipoDeNotificacao,
  type UsoDoLimite,
} from "@finnagent/contracts";
import { valorDaOcorrencia } from "../../financas/dominio/vista.js";

/** Um aviso a criar. Sem `userId`, vai para todos da conta, cada um com a própria preferência. */
export type PedidoDeNotificacao = {
  tipo: TipoDeNotificacao;
  titulo: string;
  texto: string;
  destino: DestinoDaNotificacao;
  /** O fato que gerou o aviso. Junto com o usuário, vira a chave de idempotência: o mesmo fato avisa uma vez. */
  chave: string;
  userId?: string;
};

/** Os avisos do dia (vencimentos, conferência e metas) saem a partir desta hora local, não de madrugada. */
export const HORA_DOS_AVISOS_DO_DIA = "08:00";

/** O push de uma notificação mais velha que isso não sai: a fila atrasou e o aviso perdeu a hora. */
export const VALIDADE_DO_PUSH_MS = 60 * 60 * 1000;

/** O plano parado só vira aviso depois deste tempo: antes disso a pessoa ainda deve estar na conversa. */
export const ESPERA_DO_PLANO_MS = 10 * 60 * 1000;

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function dinheiro(cents: number) {
  return reais.format(Math.abs(cents) / 100);
}

/** "HH:MM" no fuso da conta. */
export function horaNoFuso(fuso: string, agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: fuso,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const parte = (tipo: string) => partes.find((item) => item.type === tipo)?.value ?? "00";
  return `${parte("hour")}:${parte("minute")}`;
}

/** Lançamento pendente que vence hoje. Saída avisa o valor a pagar; entrada, o que deve cair. */
export function vencimentosDeHoje(entries: Lancamento[], hoje: string): PedidoDeNotificacao[] {
  const pedidos: PedidoDeNotificacao[] = [];
  for (const entry of entries) {
    for (const ocorrencia of ocorrenciasDoLancamento(entry)) {
      if (ocorrencia.status !== "pending" || ocorrencia.dueDate !== hoje) continue;
      const cents = valorDaOcorrencia(ocorrencia);
      pedidos.push({
        tipo: "vencimentos",
        titulo: entry.description || entry.name || entry.sessionName,
        texto: cents < 0 ? `Vence hoje: ${dinheiro(cents)}.` : `Entrada prevista para hoje: ${dinheiro(cents)}.`,
        destino: { tela: "financas", id: null },
        chave: `vencimento:${entry.id}:${ocorrencia.number}`,
      });
    }
  }
  return pedidos;
}

function somarDias(iso: string, dias: number) {
  const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/** Saída pendente que vence amanhã: dá tempo de separar o dinheiro. A entrada de amanhã não avisa. */
export function vencimentosDeAmanha(entries: Lancamento[], hoje: string): PedidoDeNotificacao[] {
  const amanha = somarDias(hoje, 1);
  const pedidos: PedidoDeNotificacao[] = [];
  for (const entry of entries) {
    for (const ocorrencia of ocorrenciasDoLancamento(entry)) {
      if (ocorrencia.status !== "pending" || ocorrencia.dueDate !== amanha || ocorrencia.kind === "multa") continue;
      const cents = valorDaOcorrencia(ocorrencia);
      if (cents >= 0) continue;
      pedidos.push({
        tipo: "vencimentos",
        titulo: entry.description || entry.name || entry.sessionName,
        texto: `Vence amanhã: ${dinheiro(cents)}.`,
        destino: { tela: "hoje", id: null },
        chave: `vencimento:amanha:${entry.id}:${ocorrencia.number}`,
      });
    }
  }
  return pedidos;
}

/** Os dias de atraso em que o aviso volta: no dia seguinte ao vencimento e depois uma vez por semana, por um mês. */
export const DIAS_DO_AVISO_DE_ATRASO = [1, 8, 15, 22, 29];

/**
 * O que venceu e não foi marcado: a saída atrasada (parcela, empréstimo, conta) e a entrada que não foi marcada como
 * recebida. Avisa no dia seguinte e uma vez por semana durante o primeiro mês; depois a Hoje continua mostrando.
 */
export function atrasados(entries: Lancamento[], hoje: string): PedidoDeNotificacao[] {
  const pedidos: PedidoDeNotificacao[] = [];
  for (const entry of entries) {
    for (const ocorrencia of ocorrenciasDoLancamento(entry)) {
      if (ocorrencia.status !== "pending" || ocorrencia.dueDate >= hoje || ocorrencia.kind === "multa") continue;
      const dias = diasEntre(ocorrencia.dueDate, hoje);
      if (!DIAS_DO_AVISO_DE_ATRASO.includes(dias)) continue;
      const cents = valorDaOcorrencia(ocorrencia);
      const quando = dias === 1 ? "ontem" : `há ${dias} dias`;
      pedidos.push({
        tipo: "vencimentos",
        titulo: entry.description || entry.name || entry.sessionName,
        texto:
          cents < 0
            ? `Venceu ${quando} e não foi marcado como pago: ${dinheiro(cents)}. Se já pagou, marque na Hoje.`
            : `A entrada prevista para ${dias === 1 ? "ontem" : `${dias} dias atrás`} não foi marcada como recebida: ${dinheiro(cents)}.`,
        destino: { tela: "hoje", id: null },
        chave: `atraso:${entry.id}:${ocorrencia.number}:${dias}`,
      });
    }
  }
  return pedidos;
}

/** Quanto tempo depois do fim a pergunta ainda sai como notificação. Depois disso, fica só na Hoje. */
export const JANELA_DA_PERGUNTA_DE_GASTO_MS = 3 * 60 * 60 * 1000;

/** "Teve gasto?" logo depois que o compromisso termina. Uma vez por compromisso e dia. */
export function avisosDeGasto(perguntas: PerguntaDeGasto[], agora: Date): PedidoDeNotificacao[] {
  return perguntas
    .filter((item) => {
      const passou = agora.getTime() - Date.parse(item.endedAt);
      return passou >= 0 && passou <= JANELA_DA_PERGUNTA_DE_GASTO_MS;
    })
    .map((item) => ({
      tipo: "gastos" as const,
      titulo: `Teve gasto em ${item.title}?`,
      texto: item.sessionLabel
        ? `Terminou às ${item.endedAtLocal}. Lance quanto foi, em ${item.sessionLabel}, ou diga que não teve.`
        : `Terminou às ${item.endedAtLocal}. Lance quanto foi ou diga que não teve.`,
      destino: { tela: "hoje" as const, id: null },
      chave: `gasto:${item.appointmentId}:${item.date}`,
    }));
}

/** A tarefa da noite: depois desta hora, as tarefas que ficaram abertas no dia. */
export const HORA_DO_AVISO_DAS_TAREFAS = "20:00";

/** As tarefas da raiz que ficaram abertas hoje. Uma vez por dia; sem tarefa aberta, nada. */
export function avisoDeTarefas(titulos: string[], hoje: string): PedidoDeNotificacao[] {
  if (titulos.length === 0) return [];
  const primeiras = titulos.slice(0, 3).join(", ");
  const resto = titulos.length > 3 ? ` e mais ${titulos.length - 3}` : "";
  return [
    {
      tipo: "tarefas",
      titulo: titulos.length === 1 ? "1 tarefa ficou aberta hoje" : `${titulos.length} tarefas ficaram abertas hoje`,
      texto: `${primeiras}${resto}. Marque o que fez; o resto passa para amanhã.`,
      destino: { tela: "hoje", id: null },
      chave: `tarefas:${hoje}`,
    },
  ];
}

/** Compromisso que começa dentro da antecedência escolhida na conta. */
export function lembretesNaJanela(
  compromissos: Compromisso[],
  agora: Date,
  antecedenciaMs: number,
  hoje: string,
): PedidoDeNotificacao[] {
  const pedidos: PedidoDeNotificacao[] = [];
  const agoraMs = agora.getTime();
  for (const item of compromissos) {
    if (item.status === "done") continue;
    const inicio = Date.parse(item.startAt);
    if (Number.isNaN(inicio)) continue;
    const falta = inicio - agoraMs;
    if (falta < 0 || falta > antecedenciaMs) continue;
    const dia = `${item.year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;
    const quando = dia === hoje ? "Hoje" : "Amanhã";
    pedidos.push({
      tipo: "lembretes",
      titulo: item.title,
      texto: item.allDay || !item.time ? `${quando}, o dia inteiro.` : `${quando} às ${item.time}.`,
      destino: { tela: "agenda", id: null },
      chave: `lembrete:${item.id}:${item.startAt}`,
    });
  }
  return pedidos;
}

/** Linhas de extrato sem lançamento: o dinheiro delas ainda não entrou nos totais. Um aviso por dia. */
export function avisoDeConferencia(quantas: number, hoje: string): PedidoDeNotificacao[] {
  if (quantas <= 0) return [];
  return [
    {
      tipo: "extratos",
      titulo: "Extrato esperando conferência",
      texto:
        quantas === 1
          ? "1 linha de extrato está sem lançamento. Esse valor ainda não entrou nos totais."
          : `${quantas} linhas de extrato estão sem lançamento. Esses valores ainda não entraram nos totais.`,
      destino: { tela: "conferencia", id: null },
      chave: `conferencia:${hoje}`,
    },
  ];
}

/** O fim da leitura de um extrato por imagem ou PDF, que corre depois do envio. */
export function avisoDeExtratoLido(extrato: {
  id: string;
  filename: string;
  status: StatusExtrato;
  lineCount: number;
}): PedidoDeNotificacao[] {
  if (extrato.status === "processando") return [];
  const falhou = extrato.status === "falhou";
  return [
    {
      tipo: "extratos",
      titulo: falhou ? "Não foi possível ler o extrato" : "Extrato lido",
      texto: falhou
        ? `${extrato.filename}: tente de novo ou envie outro arquivo.`
        : `${extrato.filename}: ${extrato.lineCount} ${extrato.lineCount === 1 ? "linha" : "linhas"}${
            extrato.status === "com_erros" ? ", com erros para revisar" : ""
          }.`,
      destino: { tela: falhou ? "extratos" : "conferencia", id: null },
      chave: `extrato:${extrato.id}:${extrato.status}`,
    },
  ];
}

/** Dia do mês a partir do qual a parte da sobra que falta separar vira aviso. */
export const DIA_DO_AVISO_DA_PARTE = 20;

/**
 * Metas: alcançada (uma vez), prazo neste mês sem chegar ao valor, e a parte da sobra do mês que ainda não foi
 * separada (do dia 20 em diante, uma vez por mês).
 */
export function avisosDasMetas(metas: MetasResposta, hoje: string): PedidoDeNotificacao[] {
  const pedidos: PedidoDeNotificacao[] = [];
  const mes = `${metas.year}-${String(metas.month).padStart(2, "0")}`;
  const dia = Number(hoje.slice(8, 10));
  for (const meta of metas.goals) {
    if (meta.targetCents <= 0) continue;
    const falta = meta.targetCents - meta.savedCents;
    if (falta <= 0) {
      pedidos.push({
        tipo: "metas",
        titulo: "Meta alcançada",
        texto: `${meta.name} chegou a ${dinheiro(meta.targetCents)}.`,
        destino: { tela: "metas", id: null },
        chave: `meta:alcancada:${meta.id}`,
      });
      continue;
    }
    if (meta.dueYear === metas.year && meta.dueMonth === metas.month) {
      pedidos.push({
        tipo: "metas",
        titulo: "Prazo da meta neste mês",
        texto: `${meta.name}: faltam ${dinheiro(falta)} para o valor.`,
        destino: { tela: "metas", id: null },
        chave: `meta:prazo:${meta.id}:${mes}`,
      });
    }
    const parte = metas.suggested[meta.id] ?? 0;
    if (dia >= DIA_DO_AVISO_DA_PARTE && parte > 0 && metas.division[meta.id]?.approved !== true) {
      pedidos.push({
        tipo: "metas",
        titulo: "Parte do mês sem separar",
        texto: `Separe ${dinheiro(parte)} para ${meta.name} neste mês.`,
        destino: { tela: "metas", id: null },
        chave: `meta:parte:${meta.id}:${mes}`,
      });
    }
  }
  return pedidos;
}

/**
 * A sessão com limite que passou de 80% do teto do mês, e a que estourou. Cada marca avisa uma vez por mês: a
 * chave leva a sessão, o mês e a marca.
 */
export function avisosDeLimite(usos: UsoDoLimite[], mes: string): PedidoDeNotificacao[] {
  const pedidos: PedidoDeNotificacao[] = [];
  for (const uso of usos) {
    if (uso.percent >= 100) {
      pedidos.push({
        tipo: "limites",
        titulo: `${uso.sessionName} passou do limite`,
        texto: `${dinheiro(uso.usedCents)} de ${dinheiro(uso.limitCents)} neste mês (${uso.percent}%).`,
        destino: { tela: "financas", id: null },
        chave: `limite:100:${uso.sessionId}:${mes}`,
      });
    } else if (uso.percent >= AVISO_DO_LIMITE_EM) {
      pedidos.push({
        tipo: "limites",
        titulo: `${uso.sessionName} perto do limite`,
        texto: `${dinheiro(uso.usedCents)} de ${dinheiro(uso.limitCents)} neste mês (${uso.percent}%). Faltam ${dinheiro(uso.limitCents - uso.usedCents)}.`,
        destino: { tela: "financas", id: null },
        chave: `limite:${AVISO_DO_LIMITE_EM}:${uso.sessionId}:${mes}`,
      });
    }
  }
  return pedidos;
}

/** O plano do consultor que ficou esperando a aprovação. Avisa só quem abriu a conversa. */
export function avisoDePlano(plano: { conversaId: string; userId: string; titulo: string; mensagemId: string }): PedidoDeNotificacao {
  return {
    tipo: "assistente",
    titulo: "Plano esperando a sua aprovação",
    texto: plano.titulo ? `${plano.titulo}: nada muda até você aprovar.` : "Nada muda até você aprovar.",
    destino: { tela: "assistente", id: plano.conversaId },
    chave: `assistente:plano:${plano.conversaId}:${plano.mensagemId}`,
    userId: plano.userId,
  };
}

/** Por onde o push sai agora: os canais ligados para o tipo, e nenhum no horário de silêncio. A central é sempre. */
export function canaisDePush(
  preferencias: PreferenciasDeNotificacao,
  tipo: TipoDeNotificacao,
  hora: string,
): Exclude<CanalDeNotificacao, "central">[] {
  if (emSilencio(preferencias.silencio, hora)) return [];
  const canais = preferencias.canais[tipo];
  return (["celular", "navegador"] as const).filter((canal) => canais[canal]);
}
