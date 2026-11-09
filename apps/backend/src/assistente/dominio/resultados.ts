import type {
  AgendaResposta,
  BaseResposta,
  ConferenciaResposta,
  ContasResposta,
  Feriado,
  FeriadoLocal,
  GruposResposta,
  NotificacoesResposta,
  PainelResposta,
  VinculoCruzado,
} from "@finnagent/contracts";

/**
 * O resultado das consultas, no formato que o modelo lê melhor e que custa menos: uma linha por item, só com o
 * que ele usa para decidir (ids, nomes, valores, datas, situação). O JSON bruto repetia chaves e nulls em cada
 * linha, e um turno reenvia todos os resultados anteriores a cada passo.
 */
export function textoDoResultado(ferramenta: string, corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object") return null;
  const formatar = FORMATOS[ferramenta];
  if (!formatar) return null;
  try {
    return formatar(corpo as never);
  } catch {
    // Formato inesperado: o JSON limpo ainda serve.
    return null;
  }
}

/** Tira o que não diz nada: null, texto vazio, lista vazia e objeto vazio. `false` fica, porque às vezes é a resposta. */
export function limpar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(limpar);
  if (valor && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(valor)) {
      const limpo = limpar(item);
      if (limpo === null || limpo === undefined || limpo === "") continue;
      if (Array.isArray(limpo) && limpo.length === 0) continue;
      if (typeof limpo === "object" && !Array.isArray(limpo) && Object.keys(limpo).length === 0) continue;
      saida[chave] = limpo;
    }
    return saida;
  }
  return valor;
}

const FORMATOS: Record<string, (corpo: never) => string | null> = {
  consultar_lancamentos: (corpo: BaseResposta) => lancamentos(corpo),
  consultar_mes_financeiro: (corpo: PainelResposta) => painel(corpo),
  consultar_painel: (corpo: PainelResposta) => painel(corpo),
  listar_grupos_e_sessoes: (corpo: GruposResposta) => grupos(corpo),
  consultar_conferencia: (corpo: ConferenciaResposta) => conferencia(corpo),
  consultar_agenda: (corpo: AgendaResposta) => agenda(corpo),
  consultar_contas: (corpo: ContasResposta) => contas(corpo),
  consultar_feriados: (corpo: { feriados: Feriado[]; locais: FeriadoLocal[] }) => feriados(corpo),
  consultar_notificacoes: (corpo: NotificacoesResposta) => notificacoes(corpo),
};

function reais(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function lancamentos(corpo: BaseResposta) {
  if (!Array.isArray(corpo.rows)) return null;
  const periodo = corpo.day ? `${corpo.day}/${corpo.month}/${corpo.year}` : corpo.month ? `${corpo.month}/${corpo.year}` : String(corpo.year);
  const linhas = [`Lançamentos de ${periodo}: ${corpo.rows.length} linhas, total ${reais(corpo.totalCents)}.`];
  if (corpo.groups?.length) linhas.push(`Grupos: ${corpo.groups.map((grupo) => `${grupo.id}=${grupo.name}`).join("; ")}.`);
  for (const row of corpo.rows) {
    const partes = [
      `${row.entryId} oc.${row.number}`,
      row.dueDate,
      row.description && row.description !== row.name ? `${row.name} (${row.description})` : row.name,
      `${row.groupName}/${row.sessionName}`,
      row.category,
      row.situation,
      reais(row.cents),
    ];
    if (row.installment) partes.push(`parcela ${row.installment.number}/${row.installment.total}`);
    if (row.synced) partes.push("pago pelo extrato");
    if (row.transfer) partes.push("transferência (fora da sobra)");
    linhas.push(`- ${partes.join(" · ")}`);
  }
  return linhas.join("\n");
}

function painel(corpo: PainelResposta) {
  if (!Array.isArray(corpo.items)) return null;
  const periodo = corpo.day ? `${corpo.day}/${corpo.month}/${corpo.year}` : corpo.month ? `${corpo.month}/${corpo.year}` : String(corpo.year);
  const linhas = [
    `${corpo.scope === "ano" ? "Ano" : corpo.scope === "dia" ? "Dia" : "Mês"} ${periodo}: entradas ${reais(corpo.entradas)}, saídas ${reais(corpo.saidas)}, sobra ${reais(corpo.sobra)}, acumulada desde o início ${reais(corpo.sobraAcumulada)}. ${corpo.lancamentos} lançamentos, ${corpo.compromissos} compromissos, ${corpo.semConferir} linhas de extrato sem conferir.`,
  ];
  if (corpo.scope === "ano" && corpo.months?.length) {
    for (const mes of corpo.months) linhas.push(`- mês ${mes.month}: entradas ${reais(mes.entradas)}, saídas ${reais(mes.saidas)}, sobra ${reais(mes.sobra)}`);
  }
  for (const item of corpo.items) {
    const partes = [`dia ${item.day}${item.time ? ` ${item.time}` : ""}`, item.kind, item.title, item.detail];
    if (item.cents !== null) partes.push(reais(item.cents));
    linhas.push(`- ${partes.filter(Boolean).join(" · ")}`);
  }
  for (const aviso of corpo.avisos ?? []) linhas.push(`- aviso: ${aviso.kind} · ${aviso.title} · ${aviso.at}`);
  return linhas.join("\n");
}

function grupos(corpo: GruposResposta) {
  if (!Array.isArray(corpo.groups) || !Array.isArray(corpo.sessions)) return null;
  const nomes = new Map(corpo.groups.map((grupo) => [grupo.id, grupo.name]));
  const linhas = ["Grupos:"];
  for (const grupo of corpo.groups) linhas.push(`- ${grupo.id} · ${grupo.name}${grupo.description ? ` · ${grupo.description}` : ""}`);
  linhas.push("Sessões:");
  for (const sessao of corpo.sessions) {
    const partes = [
      sessao.id,
      `grupo ${nomes.get(sessao.groupId) ?? sessao.groupId}`,
      sessao.name,
      sessao.kind === "valor" ? "Fixo (uma transação por mês; parcela e fixa ocupam cada mês em que vencem)" : "Acúmulo",
      `aceita: ${sessao.categories.join(", ")}`,
      `total ${reais(sessao.totalCents)}`,
    ];
    if (sessao.endedAt) partes.push(`encerrada em ${sessao.endedAt}`);
    if (sessao.description) partes.push(sessao.description);
    if (sessao.justification) partes.push(sessao.justification);
    linhas.push(`- ${partes.join(" · ")}`);
  }
  return linhas.join("\n");
}

function vinculo(item: VinculoCruzado) {
  return `${item.entryId} "${item.description}" ${reais(item.cents)} (${item.category}, ${item.groupName}/${item.sessionName}, dia ${item.day})`;
}

function conferencia(corpo: ConferenciaResposta) {
  if (!Array.isArray(corpo.lines)) return null;
  const pagina = corpo.page ? ` Página ${corpo.page.number} de ${Math.max(1, Math.ceil(corpo.page.total / corpo.page.size))} (${corpo.page.size} por página, ${corpo.page.total} ao todo).` : "";
  const linhas = [`Conferência de ${corpo.month}/${corpo.year}: ${corpo.pending} linhas sem lançamento.${pagina}`];
  for (const linha of corpo.lines) {
    const partes = [`${linha.statementId}:${linha.line}`, linha.date, linha.description, reais(linha.cents), `conta ${linha.accountName}`];
    if (linha.ignored) partes.push("ignorada");
    if (linha.parts?.length) partes.push(`dividida: ${linha.parts.map(vinculo).join("; ")}`);
    else if (linha.link) partes.push(`já lançada: ${vinculo(linha.link)}`);
    else if (linha.entryId) partes.push(`já lançada: ${linha.entryId}`);
    if (linha.suggestion) partes.push(`sugestão (${linha.suggestionSource ?? "valor"}): ${vinculo(linha.suggestion)}`);
    if (linha.candidates?.length) partes.push(`candidatos: ${linha.candidates.map(vinculo).join("; ")}`);
    if (linha.sessionId) {
      partes.push(`sessão sugerida: ${linha.sessionId} (${linha.sessionSource ?? "nome"}${linha.appointmentTitle ? `, compromisso "${linha.appointmentTitle}"` : ""})`);
    }
    if (linha.names?.length) partes.push(`nomes já dados: ${linha.names.join(", ")}`);
    linhas.push(`- ${partes.join(" · ")}`);
  }
  return linhas.join("\n");
}

function contas(corpo: ContasResposta) {
  if (!Array.isArray(corpo.accounts)) return null;
  if (!corpo.accounts.length) return "Nenhuma conta cadastrada.";
  return ["Contas:", ...corpo.accounts.map((conta) => `- ${conta.id} · ${conta.name} · ${conta.kind === "cartao" ? "cartão de crédito" : "conta"} · saldo inicial ${reais(conta.openingCents)}`)].join("\n");
}

function feriados(corpo: { feriados: Feriado[]; locais: FeriadoLocal[] }) {
  if (!Array.isArray(corpo.feriados) || !Array.isArray(corpo.locais)) return null;
  const linhas = ["Feriados do ano:", ...corpo.feriados.map((item) => `- ${item.data} · ${item.nome} · ${item.tipo}`)];
  linhas.push(corpo.locais.length ? "Feriados locais da conta (com id):" : "Nenhum feriado local cadastrado.");
  for (const local of corpo.locais) linhas.push(`- ${local.id} · ${local.nome} · dia ${local.dia}/${local.mes}`);
  return linhas.join("\n");
}

function notificacoes(corpo: NotificacoesResposta) {
  if (!Array.isArray(corpo.itens)) return null;
  if (!corpo.itens.length) return "Nenhuma notificação.";
  const linhas = [`Notificações: ${corpo.itens.length} (${corpo.naoLidas} não lidas).`];
  for (const item of corpo.itens) {
    linhas.push(`- ${item.id} · ${item.criadaEm.slice(0, 16)} · ${item.tipo} · ${item.titulo}: ${item.texto} · tela ${item.destino.tela}${item.lidaEm ? " · lida" : " · não lida"}`);
  }
  return linhas.join("\n");
}

function agenda(corpo: AgendaResposta) {
  if (!Array.isArray(corpo.appointments) || !Array.isArray(corpo.entries)) return null;
  const linhas = ["Compromissos:"];
  for (const item of corpo.appointments) {
    const hora = item.allDay ? "dia todo" : `${item.time ?? ""}${item.endTime ? `-${item.endTime}` : ""}`;
    const partes = [item.id, `dia ${item.day}`, hora, item.title, item.calendar, item.category, item.status];
    if (item.location) partes.push(item.location);
    if (item.entryId) partes.push(`ligado ao lançamento ${item.entryId}`);
    if (item.sessionId) partes.push(`gastos na sessão ${item.sessionLabel ?? item.sessionId}: ${reais(item.spentCents)}`);
    linhas.push(`- ${partes.join(" · ")}`);
  }
  linhas.push("Vencimentos do mês:");
  for (const item of corpo.entries) {
    linhas.push(`- ${item.id} oc.${item.number} · dia ${item.day} · ${item.description} · ${item.groupName}/${item.sessionName} · ${reais(item.cents)} · ${item.situation}`);
  }
  if (corpo.sessions?.length) linhas.push(`Sessões abertas: ${corpo.sessions.map((sessao) => `${sessao.id}=${sessao.label}`).join("; ")}.`);
  if (corpo.holidays?.length) linhas.push(`Feriados: ${corpo.holidays.map((feriado) => `${feriado.data} ${feriado.nome}`).join("; ")}.`);
  return linhas.join("\n");
}
