// Nome legível do aparelho a partir do User-Agent guardado na sessão. É só uma dica para a pessoa reconhecer
// onde entrou: não identifica ninguém e erra nos casos raros.
export function dispositivoDe(userAgent: string) {
  const texto = userAgent.trim();
  if (!texto) return "Aparelho desconhecido";
  const navegador = navegadorDe(texto);
  const sistema = sistemaDe(texto);
  if (navegador && sistema) return `${navegador} em ${sistema}`;
  return navegador ?? sistema ?? "Aparelho desconhecido";
}

function navegadorDe(texto: string) {
  if (/Edg(e|A|iOS)?\//.test(texto)) return "Edge";
  if (/OPR\/|Opera/.test(texto)) return "Opera";
  if (/Firefox\/|FxiOS\//.test(texto)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(texto)) return "Chrome";
  if (/Safari\//.test(texto)) return "Safari";
  if (/^curl\//i.test(texto)) return "curl";
  return null;
}

function sistemaDe(texto: string) {
  if (/Windows/.test(texto)) return "Windows";
  if (/Android/.test(texto)) return "Android";
  if (/iPhone|iPad|iPod/.test(texto)) return "iOS";
  if (/Mac OS X|Macintosh/.test(texto)) return "macOS";
  if (/Linux|X11/.test(texto)) return "Linux";
  return null;
}
