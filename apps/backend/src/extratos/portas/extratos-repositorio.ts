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
  ): Promise<Extrato | "ausente" | "duplicado">;
  excluir(tenantId: string, id: string): Promise<void | "ausente">;
  listarLinhasNoMes(tenantId: string, year: number, month: number): Promise<LinhaImportada[]>;
  obterLinha(tenantId: string, statementId: string, line: number): Promise<LinhaImportada | "ausente">;
  confirmarCruzamento(
    tenantId: string,
    statementId: string,
    line: number,
    entryId: string,
  ): Promise<void | "ausente" | "lancamento-ausente">;
};
