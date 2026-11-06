import type { Extrato, ExtratosResposta, FormatoExtrato, LinhaExtrato, MapeamentoExtrato } from "@finnagent/contracts";
import type { LeituraExtrato } from "../dominio/ler-extrato.js";

export const EXTRATOS_REPOSITORIO = Symbol("EXTRATOS_REPOSITORIO");

export type GravacaoExtrato = {
  id: string;
  filename: string;
  format: FormatoExtrato;
  bytes: Buffer;
  contentHash: string;
  accountId: string | null;
  accountName: string | null;
  note: string;
  mapping: MapeamentoExtrato | null;
  leitura: LeituraExtrato;
};

export type ReservaExtrato = {
  id: string;
  filename: string;
  bytes: Buffer;
  contentHash: string;
  accountId: string | null;
  accountName: string | null;
  note: string;
};

export type ConteudoExtrato = {
  filename: string;
  bytes: Buffer;
  note: string;
  mapping: MapeamentoExtrato | null;
};

export type LinhaImportada = {
  statementId: string;
  line: number;
  date: string;
  description: string;
  cents: number;
  accountId: string;
  accountName: string;
  filename: string;
  entryId: string | null;
  /** O lançamento da linha nasceu dela (acúmulo), e não de um cruzamento com um que já existia. */
  entryCreated: boolean;
  ignored: boolean;
  /** As partes da linha dividida, na ordem. Vazio quando não foi dividida. */
  parts: ParteGravada[];
  importedAt: string;
};

/** Uma parte da linha dividida. `created` é falso quando a parte pagou o lançamento que já existia na sessão fixa. */
export type ParteGravada = { entryId: string; cents: number; created: boolean };

export type LinhaDoExtrato = { statementId: string; line: number };

export type OndeEstaoOsLancamentos = { entryIds?: string[]; sessionId?: string; groupId?: string };

/** Um nome dado pela pessoa a uma descrição do extrato (`key` é a descrição normalizada). */
export type NomeLembrado = { key: string; name: string };

export type ExtratosRepositorio = {
  listar(tenantId: string): Promise<ExtratosResposta>;
  criar(tenantId: string, pedido: GravacaoExtrato): Promise<Extrato | "duplicado" | "identificador" | "conta-ausente">;
  linhas(
    tenantId: string,
    id: string,
    somenteErros: boolean,
  ): Promise<{ lines: LinhaExtrato[]; total: number; matched: number } | "ausente">;
  carregar(tenantId: string, id: string): Promise<ConteudoExtrato | "ausente">;
  substituir(
    tenantId: string,
    id: string,
    leitura: LeituraExtrato,
    mapping: MapeamentoExtrato | null,
    operacao?: "importar-extrato" | "reprocessar-extrato",
  ): Promise<Extrato | "ausente" | "duplicado">;
  excluir(tenantId: string, id: string): Promise<void | "ausente">;
  reservar(
    tenantId: string,
    pedido: ReservaExtrato,
  ): Promise<{ extrato: Extrato; novo: boolean } | "identificador" | "conta-ausente" | "duplicado">;
  marcarProcessando(tenantId: string, id: string): Promise<Extrato | "ausente">;
  falhar(tenantId: string, id: string, message: string): Promise<void>;
  listarLinhasNoMes(tenantId: string, year: number, month: number): Promise<LinhaImportada[]>;
  contarLinhasDoLancamento(tenantId: string, entryId: string, year: number, month: number): Promise<number>;
  ultimoMesPendente(tenantId: string): Promise<{ year: number; month: number } | null>;
  contarSemLancamento(tenantId: string, year: number, month: number | null): Promise<number>;
  obterLinha(tenantId: string, statementId: string, line: number): Promise<LinhaImportada | "ausente">;
  /** Ignora ou reativa linhas. Ignorar só vale para linha sem lançamento. Devolve quantas mudaram. */
  ignorarLinhas(
    tenantId: string,
    itens: { statementId: string; line: number }[],
    ignorar: boolean,
  ): Promise<number>;
  confirmarCruzamento(
    tenantId: string,
    statementId: string,
    line: number,
    entryId: string,
    name: string | null,
    lembrar?: NomeLembrado | null,
    criado?: boolean,
  ): Promise<void | "ausente" | "lancamento-ausente" | "cruzada">;
  /** Liga a linha às partes já criadas, em uma transação. A primeira parte vira o lançamento da linha. */
  dividirLinha(
    tenantId: string,
    statementId: string,
    line: number,
    partes: ParteGravada[],
    lembrar: NomeLembrado[],
  ): Promise<void | "ausente" | "cruzada" | "ignorada">;
  /**
   * Solta a linha dividida e devolve as partes: as criadas quem chamou apaga, as que pagaram um lançamento que já
   * existia ele reabre. Os nomes e a associação que essas partes criadas deixaram somem junto (`key` é a descrição).
   */
  desfazerDivisao(tenantId: string, statementId: string, line: number, key: string): Promise<ParteGravada[]>;
  /** Os nomes lembrados da conta, do uso mais recente ao mais antigo. */
  listarNomes(tenantId: string): Promise<NomeLembrado[]>;
  /**
   * Solta a linha do lançamento. Se o lançamento nasceu da linha, o nome e a associação que ele deixou somem junto
   * (`key` é a descrição normalizada), e quem chamou apaga o lançamento.
   */
  desfazerCruzamento(
    tenantId: string,
    statementId: string,
    line: number,
    key?: string,
  ): Promise<{ entryId: string; created: boolean } | "ausente" | "livre">;
  /** As linhas cruzadas de um extrato, na ordem. */
  linhasCruzadasDoExtrato(tenantId: string, id: string): Promise<LinhaDoExtrato[]>;
  /** Todas as linhas da conta que estão cruzadas ou divididas. */
  linhasCruzadas(tenantId: string): Promise<LinhaDoExtrato[]>;
  /** Volta todas as linhas ignoradas para a conferência. Devolve quantas. */
  reativarTodas(tenantId: string): Promise<number>;
  /** Esquece todos os nomes lembrados e as associações de descrição. Devolve quantos. */
  esquecerTudo(tenantId: string): Promise<number>;
  /** Os lançamentos que nasceram do extrato e nenhuma linha usa mais. */
  lancamentosSoltosDoExtrato(tenantId: string): Promise<string[]>;
  /** As linhas ligadas (inteiras ou em parte) aos lançamentos pedidos, ou aos de uma sessão ou de um grupo. */
  linhasDosLancamentos(tenantId: string, onde: OndeEstaoOsLancamentos): Promise<LinhaDoExtrato[]>;
  /** Esquece as associações de descrição que apontam para a sessão. */
  esquecerAssociacoesDaSessao(tenantId: string, sessionId: string): Promise<void>;
  /** O lançamento nasceu do extrato e nenhuma linha nem parte aponta mais para ele. */
  lancamentoSoltoDoExtrato(tenantId: string, entryId: string): Promise<boolean>;
  listarAssociacoes(
    tenantId: string,
  ): Promise<Array<{ name: string; sessionId: string; entryId: string | null }>>;
};
