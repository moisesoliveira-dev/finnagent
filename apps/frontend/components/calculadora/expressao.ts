// Avaliador das contas da calculadora, sem eval. Aceita vírgula ou ponto como decimal, + − × ÷ ^, parênteses,
// raiz (√), menos na frente e porcentagem do jeito das calculadoras: "200 + 10%" é 220 e "200 × 10%" é 20.

export type Resultado = { ok: true; valor: number } | { ok: false; erro: string };

type Token =
  | { tipo: "numero"; valor: number }
  | { tipo: "op"; valor: "+" | "-" | "*" | "/" | "^" }
  | { tipo: "abre" }
  | { tipo: "fecha" }
  | { tipo: "raiz" }
  | { tipo: "porcento" };

const OPERADORES: Record<string, "+" | "-" | "*" | "/" | "^"> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "*": "*",
  "×": "*",
  x: "*",
  "/": "/",
  "÷": "/",
  ":": "/",
  "^": "^",
};

class ErroDaConta extends Error {}

/** Lê um número escrito à brasileira (1.234,56) ou com ponto decimal (1234.56). */
function numeroDe(texto: string) {
  let limpo = texto;
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replace(/\./g, "");
  const valor = Number(limpo);
  if (!Number.isFinite(valor)) throw new ErroDaConta(`Número inválido: ${texto}`);
  return valor;
}

function tokens(texto: string): Token[] {
  const lista: Token[] = [];
  let i = 0;
  const entrada = texto.replace(/R\$/gi, "");
  while (i < entrada.length) {
    const letra = entrada[i] as string;
    if (/\s/.test(letra)) {
      i += 1;
      continue;
    }
    if (/[\d.,]/.test(letra)) {
      let fim = i;
      while (fim < entrada.length && /[\d.,]/.test(entrada[fim] as string)) fim += 1;
      lista.push({ tipo: "numero", valor: numeroDe(entrada.slice(i, fim)) });
      i = fim;
      continue;
    }
    if (letra === "(") lista.push({ tipo: "abre" });
    else if (letra === ")") lista.push({ tipo: "fecha" });
    else if (letra === "√") lista.push({ tipo: "raiz" });
    else if (letra === "%") lista.push({ tipo: "porcento" });
    else if (letra === "²") {
      lista.push({ tipo: "op", valor: "^" }, { tipo: "numero", valor: 2 });
    } else if (OPERADORES[letra]) lista.push({ tipo: "op", valor: OPERADORES[letra] });
    else throw new ErroDaConta(`Não entendi "${letra}".`);
    i += 1;
  }
  return lista;
}

/** Descida recursiva: soma > produto > potência > unário > primário, com o % depois do número. */
class Leitor {
  private posicao = 0;
  private readonly lista: Token[];

  constructor(lista: Token[]) {
    this.lista = lista;
  }

  ler() {
    if (!this.lista.length) throw new ErroDaConta("Digite uma conta.");
    const valor = this.soma();
    if (this.posicao < this.lista.length) throw new ErroDaConta("A conta tem algo sobrando.");
    return valor;
  }

  private atual() {
    return this.lista[this.posicao];
  }

  private soma(): number {
    let valor = this.produto();
    for (;;) {
      const token = this.atual();
      if (token?.tipo !== "op" || (token.valor !== "+" && token.valor !== "-")) return valor;
      this.posicao += 1;
      const { valor: direita, porcento } = this.produtoComPorcento();
      // "200 + 10%" soma 10% de 200, como nas calculadoras.
      const parcela = porcento ? (valor * direita) / 100 : direita;
      valor = token.valor === "+" ? valor + parcela : valor - parcela;
    }
  }

  /** O produto à direita de + ou −, dizendo se ele terminou em %, para a soma usar a porcentagem do que veio antes. */
  private produtoComPorcento() {
    const inicio = this.posicao;
    const valor = this.produto();
    const ultimo = this.lista[this.posicao - 1];
    const porcento = ultimo?.tipo === "porcento" && this.posicao - inicio === 2 && this.lista[inicio]?.tipo === "numero";
    return { valor: porcento ? (this.lista[inicio] as { valor: number }).valor : valor, porcento };
  }

  private produto(): number {
    let valor = this.potencia();
    for (;;) {
      const token = this.atual();
      if (token?.tipo !== "op" || (token.valor !== "*" && token.valor !== "/")) return valor;
      this.posicao += 1;
      const direita = this.potencia();
      if (token.valor === "/" && direita === 0) throw new ErroDaConta("Não dá para dividir por zero.");
      valor = token.valor === "*" ? valor * direita : valor / direita;
    }
  }

  private potencia(): number {
    const base = this.unario();
    const token = this.atual();
    if (token?.tipo === "op" && token.valor === "^") {
      this.posicao += 1;
      return base ** this.potencia();
    }
    return base;
  }

  private unario(): number {
    const token = this.atual();
    if (token?.tipo === "op" && (token.valor === "-" || token.valor === "+")) {
      this.posicao += 1;
      const valor = this.unario();
      return token.valor === "-" ? -valor : valor;
    }
    if (token?.tipo === "raiz") {
      this.posicao += 1;
      const valor = this.unario();
      if (valor < 0) throw new ErroDaConta("Não há raiz de número negativo.");
      return Math.sqrt(valor);
    }
    return this.comPorcento(this.primario());
  }

  private comPorcento(valor: number) {
    if (this.atual()?.tipo !== "porcento") return valor;
    this.posicao += 1;
    return valor / 100;
  }

  private primario(): number {
    const token = this.atual();
    if (token?.tipo === "numero") {
      this.posicao += 1;
      return token.valor;
    }
    if (token?.tipo === "abre") {
      this.posicao += 1;
      const valor = this.soma();
      if (this.atual()?.tipo !== "fecha") throw new ErroDaConta("Falta fechar o parêntese.");
      this.posicao += 1;
      return valor;
    }
    throw new ErroDaConta(token ? "A conta está incompleta." : "A conta termina num operador.");
  }
}

export function avaliar(texto: string): Resultado {
  try {
    const valor = new Leitor(tokens(texto)).ler();
    if (!Number.isFinite(valor)) return { ok: false, erro: "O resultado é grande demais." };
    // Tira o ruído do ponto flutuante (0,1 + 0,2), sem perder casas de verdade.
    return { ok: true, valor: Number(valor.toPrecision(12)) };
  } catch (error) {
    return { ok: false, erro: error instanceof ErroDaConta ? error.message : "Não consegui fazer essa conta." };
  }
}

/** O valor de um campo em centavos: aceita um número ou uma conta ("120,50 / 2"). Nulo quando não dá. */
export function centavosDaConta(texto: string) {
  if (!texto.trim()) return null;
  const resultado = avaliar(texto);
  if (!resultado.ok) return null;
  const centavos = Math.round(resultado.valor * 100);
  return Number.isSafeInteger(centavos) && Math.abs(centavos) <= 2_147_483_647 ? centavos : null;
}

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 10 });

/** O número como a pessoa lê: vírgula decimal e ponto nos milhares. */
export function formatarNumero(valor: number) {
  return numero.format(valor);
}
