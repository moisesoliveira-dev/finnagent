import {
  EXTENSOES_DE_ANEXO_DO_CHAT,
  LIMITE_ANEXO_DO_CHAT_BYTES,
  LIMITE_ANEXOS_DO_CHAT,
  LIMITE_ANEXOS_DO_CHAT_TOTAL_BYTES,
  anexoAceito,
  type AnexoDoPedido,
} from "@finnagent/contracts";

/** O arquivo já lido, esperando o envio. `size` é só para a tela. */
export type AnexoPendente = AnexoDoPedido & { size: number };

export const TIPOS_ACEITOS = EXTENSOES_DE_ANEXO_DO_CHAT.map((extensao) => `.${extensao}`).join(",");

const MEGA = 1024 * 1024;

export function tamanhoDoAnexo(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return bytes < MEGA ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / MEGA).toFixed(1)} MB`;
}

function emBase64(arquivo: File) {
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(new Error(`Não consegui ler o arquivo ${arquivo.name}.`));
    leitor.readAsDataURL(arquivo);
  });
}

/** Confere os arquivos escolhidos contra os limites e os junta aos que já estavam. `erro` diz o que ficou de fora. */
export async function juntarArquivos(novos: File[], atuais: AnexoPendente[]) {
  const anexos = [...atuais];
  let total = atuais.reduce((soma, anexo) => soma + anexo.size, 0);
  let erro: string | null = null;
  for (const arquivo of novos) {
    if (anexos.some((anexo) => anexo.name === arquivo.name && anexo.size === arquivo.size)) continue;
    if (anexos.length >= LIMITE_ANEXOS_DO_CHAT) {
      erro = `Anexe até ${LIMITE_ANEXOS_DO_CHAT} arquivos por mensagem.`;
      break;
    }
    if (!anexoAceito(arquivo.name)) {
      erro = `O arquivo ${arquivo.name} não pode ser anexado. Envie CSV, OFX, texto, PDF ou imagem.`;
      continue;
    }
    if (arquivo.size === 0) {
      erro = `O arquivo ${arquivo.name} está vazio.`;
      continue;
    }
    if (arquivo.size > LIMITE_ANEXO_DO_CHAT_BYTES) {
      erro = `O arquivo ${arquivo.name} passa de ${Math.floor(LIMITE_ANEXO_DO_CHAT_BYTES / MEGA)} MB.`;
      continue;
    }
    if (total + arquivo.size > LIMITE_ANEXOS_DO_CHAT_TOTAL_BYTES) {
      erro = `Os anexos somam mais de ${Math.floor(LIMITE_ANEXOS_DO_CHAT_TOTAL_BYTES / MEGA)} MB. Envie menos arquivos por vez.`;
      continue;
    }
    try {
      anexos.push({ name: arquivo.name, mediaType: arquivo.type, size: arquivo.size, content: await emBase64(arquivo) });
      total += arquivo.size;
    } catch (error) {
      erro = error instanceof Error ? error.message : "Não consegui ler o arquivo.";
    }
  }
  return { anexos, erro };
}

/** O que vai no corpo do pedido: sem o tamanho, que o servidor mede de novo. */
export function paraOPedido(anexos: AnexoPendente[]): AnexoDoPedido[] {
  return anexos.map(({ name, mediaType, content }) => ({ name, mediaType, content }));
}
