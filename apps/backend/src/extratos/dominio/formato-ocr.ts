const EXTENSOES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export function tipoDaMidia(filename: string) {
  const nome = filename.trim().toLowerCase();
  const extensao = Object.keys(EXTENSOES).find((item) => nome.endsWith(item));
  return extensao ? EXTENSOES[extensao] : null;
}

export function ehOcr(filename: string) {
  return tipoDaMidia(filename) != null;
}
