export async function chamar<T>(path: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const corpo = (await resposta.json().catch(() => ({}))) as { message?: string | string[] };
  if (!resposta.ok) {
    const mensagem = Array.isArray(corpo.message) ? corpo.message[0] : corpo.message;
    throw new Error(mensagem || "O backend não respondeu.");
  }
  return corpo as T;
}

export function dataCurta(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function desde(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date(iso)).replace(".", "");
}
