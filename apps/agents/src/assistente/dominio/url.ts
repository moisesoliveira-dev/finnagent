import { estaNoRailway } from "@finnagent/contracts";

const PRIVADOS = [/^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^0\./];

/**
 * A URL do provedor vem da configuração da conta. Na nuvem, ela não pode apontar para a rede privada do
 * Railway nem para endereços internos: senão o agents viraria uma porta para dentro da infraestrutura.
 * Na máquina local tudo vale, para o Ollama e afins.
 */
export function erroDaUrl(valor: string, env: Record<string, string | undefined> = process.env): string | null {
  if (!valor) return null;
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return "A URL do provedor é inválida.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "A URL do provedor precisa começar com http ou https.";
  if (!estaNoRailway(env)) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const interno =
    host === "localhost" ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    PRIVADOS.some((faixa) => faixa.test(host));
  if (url.protocol !== "https:") return "Na nuvem, a URL do provedor precisa ser https.";
  if (interno) return "Na nuvem, a URL do provedor não pode apontar para um endereço interno.";
  return null;
}
