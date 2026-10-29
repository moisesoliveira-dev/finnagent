import {
  ESQUEMA_PLANO,
  FERRAMENTA_PERGUNTAR,
  FERRAMENTA_PLANO,
  FERRAMENTAS_POR_NOME,
  FERRAMENTAS_QUE_CRIAM,
} from "@finnagent/contracts";

/** Um passo pronto para executar: os argumentos já validados e as referências trocadas pelos ids reais. */
export type PassoValidado = {
  ferramenta: string;
  descricao: string;
  args: Record<string, unknown>;
  /** O id que o passo dá ao que cria. Só vale nas ferramentas que criam. */
  idGerado: string;
  destrutiva: boolean;
};

export type PlanoValidado = {
  objetivo: string;
  entendimento: string;
  suposicoes: string[];
  passos: PassoValidado[];
};

const REFERENCIA = /^@passo:(\d+)$/;

/**
 * Confere o plano antes de mostrar à pessoa: cada passo usa uma ferramenta que muda o sistema, com argumentos
 * válidos. Os ids dos passos que criam são dados aqui, então os seguintes podem apontar para eles com
 * "@passo:N" e o plano é validado por inteiro antes de qualquer coisa rodar. Devolve o motivo, se recusar.
 */
export function validarPlano(entrada: unknown, gerarId: () => string): PlanoValidado | string {
  const lido = ESQUEMA_PLANO.safeParse(entrada);
  if (!lido.success) return `Plano inválido: ${problemasDe(lido.error.issues)}.`;
  const passos: PassoValidado[] = [];
  for (const [indice, passo] of lido.data.passos.entries()) {
    const numero = indice + 1;
    if (passo.ferramenta === FERRAMENTA_PLANO || passo.ferramenta === FERRAMENTA_PERGUNTAR) {
      return `Passo ${numero}: ${passo.ferramenta} não entra no plano.`;
    }
    const ferramenta = FERRAMENTAS_POR_NOME.get(passo.ferramenta);
    if (!ferramenta) return `Passo ${numero}: a ferramenta ${passo.ferramenta} não existe.`;
    if (ferramenta.leitura) {
      return `Passo ${numero}: ${passo.ferramenta} só consulta. Consulte antes de propor; o plano é só para o que muda o sistema.`;
    }
    const resolvidos = resolver(passo.args, passos, numero);
    if (typeof resolvidos === "string") return `Passo ${numero}: ${resolvidos}`;
    const validos = ferramenta.esquema.safeParse(resolvidos);
    if (!validos.success) return `Passo ${numero} (${passo.ferramenta}): ${problemasDe(validos.error.issues)}.`;
    passos.push({
      ferramenta: passo.ferramenta,
      descricao: passo.descricao,
      args: validos.data as Record<string, unknown>,
      idGerado: gerarId(),
      destrutiva: ferramenta.destrutiva,
    });
  }
  return {
    objetivo: lido.data.objetivo,
    entendimento: lido.data.entendimento,
    suposicoes: lido.data.suposicoes,
    passos,
  };
}

class ReferenciaInvalida extends Error {}

// Troca "@passo:N" pelo id do passo N, em qualquer nível dos argumentos.
function resolver(valor: unknown, anteriores: PassoValidado[], numero: number): unknown {
  try {
    return trocar(valor, anteriores, numero);
  } catch (error) {
    if (error instanceof ReferenciaInvalida) return error.message;
    throw error;
  }
}

function trocar(valor: unknown, anteriores: PassoValidado[], numero: number): unknown {
  if (typeof valor === "string") {
    const ref = REFERENCIA.exec(valor.trim());
    if (!ref) return valor;
    const alvo = Number(ref[1]);
    if (alvo < 1 || alvo >= numero) throw new ReferenciaInvalida(`"${valor}" aponta para um passo que ainda não aconteceu.`);
    const passo = anteriores[alvo - 1];
    if (!passo || !FERRAMENTAS_QUE_CRIAM.has(passo.ferramenta)) {
      throw new ReferenciaInvalida(`"${valor}" aponta para um passo que não cria nada.`);
    }
    return passo.idGerado;
  }
  if (Array.isArray(valor)) return valor.map((item) => trocar(item, anteriores, numero));
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([chave, item]) => [chave, trocar(item, anteriores, numero)]));
  }
  return valor;
}

function problemasDe(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  return issues
    .slice(0, 5)
    .map((item) => `${item.path.map(String).join(".") || "campo"}: ${item.message}`)
    .join("; ");
}
