export function chaveDoNome(description: string) {
  return description.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR").slice(0, 160);
}
