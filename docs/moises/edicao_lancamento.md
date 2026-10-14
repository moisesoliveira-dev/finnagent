# Edição de lançamento

## Base travada na edição

O que foi feito: a edição de um lançamento deixa de alterar as propriedades definidas na criação. O movimento é o exemplo: entrada ou saída fica travada. Também ficam travadas a categoria, o tipo, a recorrência, o intervalo, o total de parcelas, o vencimento e os juros. Na edição esses campos saem do formulário e ficam numa linha de texto. Descrição e justificativa ocupam a largura do diálogo. Nome, sessão, data, valor, status, prioridade, parcela atual e próximo vencimento continuam em campo. O Nest recusa a gravação se o pedido mudar a base, com a mensagem "Movimento, categoria e os dados definidos na criação não podem ser alterados." A função pura `alterouBase` fica em `packages/contracts` e o teste em `apps/backend/src/financas/dominio/transacao.spec.ts`.

Motivo: um lançamento já criado não deve virar outro tipo de movimento nem outro contrato.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `apps/backend/src/financas/dominio/transacao.spec.ts`
- `apps/frontend/app/financas/page.tsx`
