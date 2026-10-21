# Ocorrências

## Status por ocorrência

O que foi feito: cada lançamento passa a ter ocorrências (uma por mês, parcela ou repetição do ano de início). O status fica na ocorrência: pendente, paga, cancelada ou estornada. Atrasada não é gravada; é a pendente com vencimento anterior a hoje. O valor do mês sai dessas ocorrências. Pagar, cancelar, estornar e desfazer o cancelamento são por ocorrência, com o evento `atualizar-ocorrencia`. Categoria e movimento continuam travados. Data, valor, parcelas, recorrência, vencimento e juros só mudam enquanto toda ocorrência está pendente e o lançamento não foi cruzado com o extrato. Na edição, a lista substitui o status único; quando os termos estão travados, data e valor saem dos inputs e ficam em texto. A lista marca Atrasada. O mês suspenso ou cancelado de um fixo antigo aparece como ocorrência cancelada. Desfazer esse cancelamento tira o mês da suspensão e o valor volta a contar. O texto de suspenso usa o sinal do movimento.

Motivo: o status único do lançamento não deixava pagar, cancelar ou atrasar uma parcela ou um mês sem mexer no contrato inteiro.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261020160000_ocorrencias_do_lancamento/migration.sql`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/financas/financas.controller.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `apps/backend/src/financas/dominio/ocorrencias.spec.ts`
- `apps/frontend/app/api/lancamentos/[id]/ocorrencias/[numero]/route.ts`
- `apps/frontend/app/financas/ocorrencias.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/acoes.tsx`
- `apps/frontend/app/financas/tabela.tsx`
- `apps/frontend/app/financas/rotulos.ts`

## Lista com rolagem

O que foi feito: a lista de ocorrências virou um cartão com rolagem própria. Data à esquerda, valor e chip na mesma linha, botões Pagar, Cancelar, Estornar e Desfazer ao lado (no celular, na linha de baixo). O diálogo de edição ficou mais largo. Com os termos travados, o valor do contrato usa Money. O painel antigo de ações continua abaixo, separado por uma linha.

Motivo: a lista de um ano inteiro esticava o diálogo.

Arquivos:

- `apps/frontend/components/ui/list.tsx`
