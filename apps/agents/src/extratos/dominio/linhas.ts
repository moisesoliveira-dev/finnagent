import type { LinhaExtrato } from "@finnagent/contracts";

const TIPOS = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function tipoPermitido(mediaType: string) {
  return TIPOS.has(mediaType);
}

export function normalizarLinhas(bruto: unknown): LinhaExtrato[] {
  const lista = Array.isArray(bruto) ? bruto.slice(0, 500) : [];
  return lista.map((item, index) => {
    const linha = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const description = typeof linha.description === "string" ? linha.description.trim().slice(0, 160) : "";
    const date = dataValida(linha.date);
    const cents = centavosValidos(linha.cents);
    const erros = [
      description ? "" : "Descrição ausente.",
      date ? "" : "Data ausente.",
      cents == null ? "Valor ausente." : "",
    ].filter(Boolean);
    return {
      line: index + 1,
      date,
      description,
      cents,
      error: erros.join(" "),
    };
  });
}

function dataValida(valor: unknown) {
  if (typeof valor !== "string" || !DATA.test(valor)) return null;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return valor;
}

function centavosValidos(valor: unknown) {
  if (typeof valor !== "number" || !Number.isInteger(valor)) return null;
  if (valor > 2_147_483_647 || valor < -2_147_483_648) return null;
  return valor;
}
