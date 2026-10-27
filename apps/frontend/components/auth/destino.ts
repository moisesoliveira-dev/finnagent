/** Aceita só caminho interno. Evita que `?proximo=//site-falso.com` vire redirecionamento aberto. */
export function destinoSeguro(valor: string | string[] | undefined) {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (!texto || texto.length > 300) return "/";
  if (!texto.startsWith("/") || texto.startsWith("//") || texto.includes("\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(texto)) return "/";
  if (texto === "/login" || texto === "/cadastro" || texto.startsWith("/api/")) return "/";
  return texto;
}
