import { Catch, ConflictException, NotFoundException, ServiceUnavailableException, type ArgumentsHost, type HttpException } from "@nestjs/common";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";

/**
 * O erro do Prisma que significa "o pedido bateu numa regra do banco", como uma resposta que a pessoa entende. Chave
 * repetida, referência que não existe e registro que sumiu no meio do pedido não são falha do servidor.
 */
export function traduzirErroDoBanco(erro: unknown): HttpException | null {
  if (typeof erro !== "object" || erro === null || !("clientVersion" in erro)) return null;
  const codigo = String((erro as { code?: unknown; errorCode?: unknown }).code ?? (erro as { errorCode?: unknown }).errorCode ?? "");
  // P1xxx é falha de conexão (banco fora do ar, recusou, esgotou o tempo) e P2024 é o limite de conexões: o banco volta
  // sozinho, e a pessoa só precisa tentar de novo.
  if (codigo.startsWith("P1") || codigo === "P2024") return new ServiceUnavailableException("O banco de dados está indisponível. Tente de novo em instantes.");
  switch (codigo) {
    case "P2002":
      return new ConflictException("Esse registro já existe.");
    case "P2003":
      return new ConflictException("Esse registro depende de outro que não existe ou está em uso.");
    case "P2025":
      return new NotFoundException("Registro não encontrado.");
    case "P2034":
      return new ConflictException("Outra alteração estava em andamento. Tente de novo.");
    default:
      return null;
  }
}

/** O filtro global de sempre (que avisa o Sentry do que é erro de verdade), com a tradução dos erros do banco na frente. */
@Catch()
export class FiltroDeErrosDoBanco extends SentryGlobalFilter {
  override catch(exception: unknown, host: ArgumentsHost) {
    return super.catch(traduzirErroDoBanco(exception) ?? exception, host);
  }
}
