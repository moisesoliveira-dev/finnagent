# Alma do consultor

## Mapa de interferências

O que foi feito: o consultor passa a receber, em toda conversa, o mapa de como uma mudança mexe na outra. O mapa cobre sobra, série de fixa, parcela e empréstimo, extrato, sessão de valor e de acúmulo, meta e agenda. No entendimento do plano ele nomeia o que mais muda. O número da sobra e das datas continua o que o backend calcula no cartão.

Motivo: o consultor precisa atender com as regras do Prumo, e não tratar cada lançamento como se o resto da conta não existisse.

Arquivos:

- `apps/agents/src/assistente/dominio/consultor.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/agents/src/assistente/dominio/prompts.spec.ts`

## Regras gerais da conta

O que foi feito: a série deixa de travar por inteiro. Ocorrência paga, cancelada ou estornada permanece; valor, data e regra novos valem só para o que ainda está pendente. Lançamento que aponta para outro, que já conta o valor, sai da sobra. A taxa de juros do empréstimo fica no contrato e não é somada de novo na prestação. Sessão ligada a uma meta, e qualquer sessão do grupo Metas, não aceita fixa, parcela nem empréstimo. O mapa do consultor passou a dizer o mesmo.

Motivo: essas regras valem para qualquer série, qualquer valor já incluso e qualquer meta, sem categoria especial.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261029190000_cobertura_do_lancamento/migration.sql`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/financas/dominio/pedido.ts`
- `apps/backend/src/financas/dominio/ocorrencias.spec.ts`
- `apps/backend/src/financas/financas.controller.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/acoes.tsx`
- `apps/agents/src/assistente/dominio/consultor.ts`
- `apps/agents/src/assistente/dominio/prompts.spec.ts`
