import { Fragment, type ReactNode } from "react";

/** Negrito com **, código com crase. Vira elemento React: nada do texto do modelo vira HTML. */
function emLinha(texto: string, chave: string): ReactNode[] {
  const pedacos = texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return pedacos.map((pedaco, indice) => {
    const id = `${chave}-${indice}`;
    if (pedaco.startsWith("**") && pedaco.endsWith("**") && pedaco.length > 4) {
      return <strong key={id} className="font-semibold">{pedaco.slice(2, -2)}</strong>;
    }
    if (pedaco.startsWith("`") && pedaco.endsWith("`") && pedaco.length > 2) {
      return (
        <code key={id} className="border border-line bg-surface-2 px-1 font-mono text-sm">
          {pedaco.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={id}>{pedaco}</Fragment>;
  });
}

type Bloco =
  | { tipo: "paragrafo"; linhas: string[] }
  | { tipo: "lista"; ordenada: boolean; itens: string[] }
  | { tipo: "titulo"; texto: string };

function blocosDe(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  for (const linha of texto.split("\n")) {
    const limpa = linha.trimEnd();
    const anterior = blocos[blocos.length - 1];
    const marcador = /^\s*[-*•]\s+(.*)$/.exec(limpa);
    const numero = /^\s*\d+[.)]\s+(.*)$/.exec(limpa);
    const titulo = /^#{1,4}\s+(.*)$/.exec(limpa);
    if (!limpa.trim()) {
      blocos.push({ tipo: "paragrafo", linhas: [] });
    } else if (titulo) {
      blocos.push({ tipo: "titulo", texto: titulo[1] });
    } else if (marcador || numero) {
      const ordenada = Boolean(numero);
      const item = (marcador ?? numero)![1];
      if (anterior?.tipo === "lista" && anterior.ordenada === ordenada) anterior.itens.push(item);
      else blocos.push({ tipo: "lista", ordenada, itens: [item] });
    } else if (anterior?.tipo === "paragrafo" && anterior.linhas.length) {
      anterior.linhas.push(limpa);
    } else {
      blocos.push({ tipo: "paragrafo", linhas: [limpa] });
    }
  }
  return blocos.filter((bloco) => bloco.tipo !== "paragrafo" || bloco.linhas.length);
}

export function TextoFormatado({ texto }: { texto: string }) {
  return (
    <div className="grid max-w-prose gap-3 leading-relaxed">
      {blocosDe(texto).map((bloco, indice) => {
        const chave = `b${indice}`;
        if (bloco.tipo === "titulo") {
          return (
            <p key={chave} className="font-display font-bold">
              {emLinha(bloco.texto, chave)}
            </p>
          );
        }
        if (bloco.tipo === "lista") {
          const Lista = bloco.ordenada ? "ol" : "ul";
          return (
            <Lista key={chave} className={bloco.ordenada ? "grid list-decimal gap-1 pl-6" : "grid list-disc gap-1 pl-6"}>
              {bloco.itens.map((item, posicao) => (
                <li key={`${chave}-${posicao}`}>{emLinha(item, `${chave}-${posicao}`)}</li>
              ))}
            </Lista>
          );
        }
        return (
          <p key={chave}>
            {bloco.linhas.map((linha, posicao) => (
              <Fragment key={`${chave}-${posicao}`}>
                {posicao > 0 ? <br /> : null}
                {emLinha(linha, `${chave}-${posicao}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
