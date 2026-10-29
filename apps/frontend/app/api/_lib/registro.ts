// O BFF não tem Pino: escreve uma linha JSON na saída padrão, no mesmo formato do backend, para o Railway guardar.
// Nunca recebe token, cookie nem corpo: só a rota, o status e o que falhou.
export function registrar(nivel: "info" | "warn" | "error", msg: string, dados: Record<string, unknown> = {}) {
  const linha = JSON.stringify({ level: nivel, time: Date.now(), servico: "frontend", msg, ...dados });
  if (nivel === "error") console.error(linha);
  else console.log(linha);
}

export function textoDoErro(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const causa = (error as { cause?: { message?: string } }).cause?.message;
  return causa ? `${error.name}: ${error.message} (${causa})` : `${error.name}: ${error.message}`;
}
