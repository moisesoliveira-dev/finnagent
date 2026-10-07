# Metas

O que foi feito: a aba Metas deixa a pessoa criar a meta com nome, valor desejado e quanto já separou, com prazo opcional de mês e ano. O cálculo usa a sobra do mês do fluxo de trabalho (entradas menos saídas dos lançamentos). A falta é o alvo menos o que já foi separado. Com prazo, mostra quanto separar por mês, contando o mês atual. Com sobra positiva, mostra em quantos meses a sobra cobre a falta. Se a sobra não é positiva, avisa que ela não cobre a meta. Se o prazo já passou, avisa. Se a falta é zero, a meta está alcançada. A prévia do cálculo aparece no formulário antes de salvar. Excluir a meta é confirmado na tela. O contrato traz os tipos `Meta`, `MetasResposta` e `CalculoMeta` e a função `calcularMeta`. O outbox grava `criar-meta` e `excluir-meta` na mesma transação, filtrando o tenant. O item Metas fica depois de Finanças e antes de Extratos; o assistente fica oculto em `/metas`. Não há variável de ambiente nova.

Motivo: a pessoa precisa ver, com o dinheiro que já tem no mês, quanto separar para chegar na meta.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261007233000_metas/`
- `apps/backend/src/metas/`
- `apps/backend/src/app.module.ts`
- `apps/frontend/app/metas/page.tsx`
- `apps/frontend/app/api/metas/`
- `apps/frontend/components/ui/app-shell.tsx`
