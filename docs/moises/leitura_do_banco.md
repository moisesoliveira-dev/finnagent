# Leitura do banco

## Conferência com menos idas

O que foi feito: a conferência lê os lançamentos uma vez, só com as ocorrências daquele mês, e busca linhas, nomes lembrados e compromissos ao mesmo tempo. Lançamento que já tem grade e não vence neste mês fica sem ocorrência aqui, em vez de receber a grade inteira. Cruzar deixa de remontar a conferência antes de gravar; cruzar, desfazer e acumular uma linha devolvem essa conferência, e a tela usa a resposta em vez de pedir o mês de novo. O lote deixa de remontar a conferência a cada linha. As linhas do plano do consultor saem numa busca só. `statement_lines` ganhou índice por tenant e data.

Motivo: cada ida ao Postgres custa a latência inteira da conexão, e a conferência repetia a base inteira.

Arquivos:

- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.spec.ts`
- `apps/backend/src/assistente/adaptadores/realidade-do-sistema.ts`
- `apps/backend/src/assistente/portas/realidade-da-conta.ts`
- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261029180000_linhas_por_data/migration.sql`
