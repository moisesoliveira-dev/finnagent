import type { Extrato, FormatoExtrato, LinhaExtrato, MapeamentoExtrato } from "@finnagent/contracts";
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
};

export type ConteudoExtrato = {
  filename: string;
  bytes: Buffer;
  mapping: MapeamentoExtrato | null;
};

export type LinhaImportada = {
  statementId: string;
  line: number;
  date: string;
  description: string;
  cents: number;
  accountName: string;
  filename: string;
  entryId: string | null;
  importedAt: string;
};

export type ExtratosRepositorio = {
  listar(tenantId: string): Promise<{ accounts: { id: string; name: string }[]; statements: Extrato[] }>;
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
  ultimoMesPendente(tenantId: string): Promise<{ year: number; month: number } | null>;
  contarSemLancamento(tenantId: string, year: number, month: number | null): Promise<number>;
  obterLinha(tenantId: string, statementId: string, line: number): Promise<LinhaImportada | "ausente">;
  confirmarCruzamento(
    tenantId: string,
    statementId: string,
    line: number,
    entryId: string,
    name: string | null,
  ): Promise<void | "ausente" | "lancamento-ausente" | "cruzada">;
  desfazerCruzamento(
    tenantId: string,
    statementId: string,
    line: number,
  ): Promise<{ entryId: string } | "ausente" | "livre">;
  contarCruzadas(tenantId: string, id: string): Promise<number>;
  listarAssociacoes(
    tenantId: string,
  ): Promise<Array<{ name: string; sessionId: string; entryId: string | null }>>;
};
