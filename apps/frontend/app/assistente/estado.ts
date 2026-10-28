import type {
  AcaoDoAssistente,
  AgenteIa,
  EventoDoChat,
  MensagemDoChat,
  ParteDaMensagem,
} from "@finnagent/contracts";

export const ID_PROVISORIO = "provisoria";

/** A mensagem da pessoa aparece na hora; o backend devolve a definitiva no evento de início. */
export function mensagemProvisoria(texto: string): MensagemDoChat {
  return {
    id: ID_PROVISORIO,
    role: "user",
    partes: [{ tipo: "texto", texto }],
    agente: null,
    createdAt: new Date().toISOString(),
  };
}

function comPartes(mensagens: MensagemDoChat[], id: string, mudar: (partes: ParteDaMensagem[]) => ParteDaMensagem[]) {
  return mensagens.map((mensagem) => (mensagem.id === id ? { ...mensagem, partes: mudar(mensagem.partes) } : mensagem));
}

function comAcao(partes: ParteDaMensagem[], acao: AcaoDoAssistente) {
  const existe = partes.some((parte) => parte.tipo === "acao" && parte.acao.id === acao.id);
  if (!existe) return [...partes, { tipo: "acao" as const, acao }];
  return partes.map((parte) => (parte.tipo === "acao" && parte.acao.id === acao.id ? { ...parte, acao } : parte));
}

function comTexto(partes: ParteDaMensagem[], delta: string) {
  const ultima = partes[partes.length - 1];
  if (ultima?.tipo === "texto") return [...partes.slice(0, -1), { ...ultima, texto: ultima.texto + delta }];
  return [...partes, { tipo: "texto" as const, texto: delta }];
}

/** Aplica um evento do assistente à lista de mensagens. `assistenteId` é a mensagem que está crescendo. */
export function aplicarEvento(
  mensagens: MensagemDoChat[],
  assistenteId: string | null,
  evento: EventoDoChat,
): { mensagens: MensagemDoChat[]; assistenteId: string | null; agente?: AgenteIa } {
  switch (evento.tipo) {
    case "inicio": {
      let lista = mensagens;
      if (evento.usuario) {
        const usuario = evento.usuario;
        lista = lista.some((item) => item.id === ID_PROVISORIO)
          ? lista.map((item) => (item.id === ID_PROVISORIO ? usuario : item))
          : [...lista, usuario];
      }
      if (!lista.some((item) => item.id === evento.assistenteId)) {
        lista = [
          ...lista,
          { id: evento.assistenteId, role: "assistant", partes: [], agente: null, createdAt: new Date().toISOString() },
        ];
      }
      return { mensagens: lista, assistenteId: evento.assistenteId };
    }
    case "agente": {
      if (!assistenteId || evento.agente === "coordenador") return { mensagens, assistenteId, agente: evento.agente };
      const lista = mensagens.map((mensagem) => {
        if (mensagem.id !== assistenteId || mensagem.agente === evento.agente) return mensagem;
        return { ...mensagem, agente: evento.agente, partes: [...mensagem.partes, { tipo: "agente" as const, agente: evento.agente }] };
      });
      return { mensagens: lista, assistenteId, agente: evento.agente };
    }
    case "texto":
      return assistenteId ? { mensagens: comPartes(mensagens, assistenteId, (partes) => comTexto(partes, evento.delta)), assistenteId } : { mensagens, assistenteId };
    case "acao":
      return assistenteId ? { mensagens: comPartes(mensagens, assistenteId, (partes) => comAcao(partes, evento.acao)), assistenteId } : { mensagens, assistenteId };
    case "pergunta":
      return assistenteId
        ? { mensagens: comPartes(mensagens, assistenteId, (partes) => [...partes, { tipo: "pergunta", pergunta: evento.pergunta }]), assistenteId }
        : { mensagens, assistenteId };
    case "resposta":
      return { mensagens: marcarResposta(mensagens, evento.perguntaId, evento.escolha), assistenteId };
    case "fim":
      return {
        mensagens: mensagens.map((mensagem) => (mensagem.id === evento.mensagem.id ? evento.mensagem : mensagem)),
        assistenteId: null,
      };
    default:
      return { mensagens, assistenteId };
  }
}

export function marcarResposta(mensagens: MensagemDoChat[], perguntaId: string, escolha: string) {
  return mensagens.map((mensagem) => ({
    ...mensagem,
    partes: mensagem.partes.map((parte) =>
      parte.tipo === "pergunta" && parte.pergunta.id === perguntaId ? { ...parte, pergunta: { ...parte.pergunta, resposta: escolha } } : parte,
    ),
  }));
}

/** Lê a resposta NDJSON do assistente, um evento por linha, à medida que chega. */
export async function* lerEventos(resposta: Response): AsyncGenerator<EventoDoChat> {
  if (!resposta.body) return;
  const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
  let resto = "";
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    resto += value;
    const linhas = resto.split("\n");
    resto = linhas.pop() ?? "";
    for (const linha of linhas) if (linha.trim()) yield JSON.parse(linha) as EventoDoChat;
  }
  if (resto.trim()) yield JSON.parse(resto) as EventoDoChat;
}
