import {
  LIMITE_ANEXO_DO_CHAT_BYTES,
  LIMITE_ANEXOS_DO_CHAT,
  LIMITE_ANEXOS_DO_CHAT_TOTAL_BYTES,
  LIMITE_TEXTO_DO_ANEXO,
  anexoAceito,
  anexoEmTexto,
  type AnexoDaMensagem,
  type AnexoDoPedido,
  type ParteDaMensagem,
} from "@finnagent/contracts";

/** O anexo guardado: o que a tela vê mais o conteúdo. */
export type AnexoGravado = AnexoDaMensagem & { content: Buffer };

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Confere os anexos do pedido e os transforma em bytes. Devolve a mensagem de erro, em português, quando algo não serve. */
export function lerAnexos(anexos: AnexoDoPedido[]): AnexoGravado[] | string {
  if (anexos.length > LIMITE_ANEXOS_DO_CHAT) return `Anexe até ${LIMITE_ANEXOS_DO_CHAT} arquivos por mensagem.`;
  const lidos: AnexoGravado[] = [];
  let total = 0;
  for (const anexo of anexos) {
    const nome = anexo.name.trim().replace(/[\\/]+/g, "_");
    if (!nome) return "Dê um nome ao arquivo anexado.";
    if (!anexoAceito(nome)) return `O arquivo ${nome} não pode ser anexado. Envie CSV, OFX, texto, PDF ou imagem.`;
    const limpo = anexo.content.replace(/\s/g, "");
    if (!limpo || !BASE64.test(limpo)) return `Não consegui ler o arquivo ${nome}.`;
    const content = Buffer.from(limpo, "base64");
    if (content.length === 0) return `O arquivo ${nome} está vazio.`;
    if (content.length > LIMITE_ANEXO_DO_CHAT_BYTES) {
      return `O arquivo ${nome} passa de ${Math.floor(LIMITE_ANEXO_DO_CHAT_BYTES / 1024 / 1024)} MB.`;
    }
    total += content.length;
    if (total > LIMITE_ANEXOS_DO_CHAT_TOTAL_BYTES) {
      return `Os anexos somam mais de ${Math.floor(LIMITE_ANEXOS_DO_CHAT_TOTAL_BYTES / 1024 / 1024)} MB. Envie menos arquivos por vez.`;
    }
    lidos.push({ id: "", name: nome, mediaType: anexo.mediaType.trim().slice(0, 100) || "application/octet-stream", size: content.length, content });
  }
  return lidos;
}

function tamanho(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Texto do arquivo: UTF-8, ou Latin-1 quando o UTF-8 não serve (OFX de banco costuma ser Latin-1). */
function textoDoArquivo(bytes: Buffer) {
  const utf8 = bytes.toString("utf8");
  return utf8.includes("\uFFFD") ? bytes.toString("latin1") : utf8;
}

/** A linha que diz ao modelo que o anexo existe e qual é o id dele. */
export function linhaDoAnexo(anexo: AnexoDaMensagem) {
  return `Anexo: ${anexo.name} (${anexo.mediaType}, ${tamanho(anexo.size)}, anexoId: ${anexo.id})`;
}

/**
 * O que o modelo lê da mensagem da pessoa: o texto e, para cada anexo, a linha com o id. O conteúdo do arquivo de
 * texto vem junto (cortado no limite); imagem e PDF só têm a linha, e viram extrato pela ferramenta de importar.
 */
export function mensagemComAnexos(texto: string, anexos: AnexoGravado[]) {
  if (!anexos.length) return texto;
  const blocos = anexos.map((anexo) => {
    const linha = linhaDoAnexo(anexo);
    if (!anexoEmTexto(anexo.name)) return `${linha}\n(Não leio imagem nem PDF na conversa. Para usar como extrato, chame importar_extrato.)`;
    const conteudo = textoDoArquivo(anexo.content);
    const corte = conteudo.length > LIMITE_TEXTO_DO_ANEXO;
    return `${linha}\n--- início de ${anexo.name} ---\n${corte ? conteudo.slice(0, LIMITE_TEXTO_DO_ANEXO) : conteudo}\n--- ${corte ? "o resto foi cortado" : "fim"} de ${anexo.name} ---`;
  });
  return `${texto}\n\n${blocos.join("\n\n")}`;
}

/** Nas mensagens antigas o modelo só precisa saber que o anexo existiu e qual é o id dele. */
export function anexosDasPartes(partes: ParteDaMensagem[]) {
  return partes.flatMap((parte) => (parte.tipo === "anexo" ? [parte.anexo] : []));
}
