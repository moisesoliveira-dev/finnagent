import { Button } from "./button";

// Páginas de uma lista longa: "1–50 de 444" e os botões para os lados. Sem nada para paginar, some.
export function Paginacao({
  pagina,
  rotulo,
  onIr,
}: {
  pagina: { number: number; size: number; total: number };
  // O nome do que se conta, no plural ("eventos"), para o leitor de tela.
  rotulo: string;
  onIr: (pagina: number) => void;
}) {
  const ultima = Math.max(1, Math.ceil(pagina.total / pagina.size));
  if (pagina.total === 0) return null;
  const de = (pagina.number - 1) * pagina.size + 1;
  const ate = Math.min(pagina.number * pagina.size, pagina.total);
  return (
    <nav aria-label={`Páginas de ${rotulo}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-sm text-ink-2 tabular-nums">
        <span className="text-ink">
          {de}–{ate}
        </span>{" "}
        de {pagina.total.toLocaleString("pt-BR")} {rotulo}
      </p>
      {ultima > 1 ? (
        <div className="flex items-center gap-2">
          <Button disabled={pagina.number <= 1} onClick={() => onIr(pagina.number - 1)}>
            ‹ Anteriores
          </Button>
          <span className="etiqueta px-2 text-ink-2 tabular-nums" aria-label={`Página ${pagina.number} de ${ultima}`}>
            {pagina.number}/{ultima}
          </span>
          <Button disabled={pagina.number >= ultima} onClick={() => onIr(pagina.number + 1)}>
            Próximos ›
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
