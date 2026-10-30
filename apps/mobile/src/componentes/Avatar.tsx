import type { TomDoAvatar } from "@finnagent/contracts";

// Cada cor é um par de tokens, como no web: só o azul e o amarelo usam o fundo cheio, que tem texto próprio.
const TONS: Record<TomDoAvatar, { fundo: string; texto: string }> = {
  brand: { fundo: "var(--brand)", texto: "var(--brand-ink)" },
  event: { fundo: "var(--event-soft)", texto: "var(--event)" },
  pos: { fundo: "var(--pos-soft)", texto: "var(--pos)" },
  pending: { fundo: "var(--pending-soft)", texto: "var(--pending)" },
  neg: { fundo: "var(--neg-soft)", texto: "var(--neg)" },
  cta: { fundo: "var(--cta)", texto: "var(--cta-ink)" },
  ink: { fundo: "var(--ink)", texto: "var(--bg)" },
};

export const ROTULO_DO_TOM: Record<TomDoAvatar, string> = {
  brand: "Azul",
  event: "Índigo",
  pos: "Verde",
  pending: "Âmbar",
  neg: "Vermelho",
  cta: "Amarelo",
  ink: "Grafite",
};

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0]?.charAt(0) ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1] ?? "").charAt(0) : "";
  return `${primeira}${ultima}`.toLocaleUpperCase("pt-BR");
}

/** As iniciais do nome sobre a cor escolhida. */
export function Avatar({ nome, tom, tamanho }: { nome: string; tom: TomDoAvatar; tamanho: number }) {
  const cor = TONS[tom];
  return (
    <span
      aria-hidden
      className="avatar"
      style={{ width: tamanho, height: tamanho, background: cor.fundo, color: cor.texto, fontSize: tamanho * 0.36 }}
    >
      {iniciais(nome)}
    </span>
  );
}
