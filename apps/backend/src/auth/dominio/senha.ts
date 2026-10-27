import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt com os parâmetros recomendados pela OWASP para senha: N=2^15, r=8, p=1.
const CUSTO = 32768;
const BLOCO = 8;
const PARALELISMO = 1;
const TAMANHO = 64;
const SAL = 16;
const MEMORIA = 128 * CUSTO * BLOCO * 2;

function derivar(senha: string, sal: Buffer, opcoes: ScryptOptions) {
  return new Promise<Buffer>((resolver, rejeitar) => {
    scrypt(senha.normalize("NFKC"), sal, TAMANHO, opcoes, (erro, chave) => {
      if (erro) rejeitar(erro);
      else resolver(chave);
    });
  });
}

/** Formato: scrypt$N$r$p$sal$hash, com sal e hash em base64. */
export async function gerarHash(senha: string) {
  const sal = randomBytes(SAL);
  const chave = await derivar(senha, sal, { N: CUSTO, r: BLOCO, p: PARALELISMO, maxmem: MEMORIA });
  return ["scrypt", CUSTO, BLOCO, PARALELISMO, sal.toString("base64"), chave.toString("base64")].join("$");
}

export async function conferirSenha(senha: string, hash: string) {
  const partes = hash.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, sal, esperado] = partes;
  const custo = Number(n);
  const bloco = Number(r);
  const paralelismo = Number(p);
  if (![custo, bloco, paralelismo].every((valor) => Number.isInteger(valor) && valor > 0)) return false;
  const guardado = Buffer.from(esperado, "base64");
  if (guardado.length !== TAMANHO) return false;
  const calculado = await derivar(senha, Buffer.from(sal, "base64"), {
    N: custo,
    r: bloco,
    p: paralelismo,
    maxmem: 128 * custo * bloco * 2,
  });
  return timingSafeEqual(calculado, guardado);
}

let referencia: Promise<string> | null = null;

/**
 * Hash de uma senha que ninguém tem. Conferir contra ele quando o e-mail não existe
 * gasta o mesmo tempo de um login real e não denuncia quais e-mails têm conta.
 */
export function hashDeReferencia() {
  referencia ??= gerarHash(randomBytes(16).toString("hex"));
  return referencia;
}
