# Agenda

## Compromissos na aba Agenda

O que foi feito: a aba Agenda mostra o mês (domingo a sábado), a lista, os filtros de compromissos e lançamentos, o dia e o formulário de novo compromisso. Os lançamentos vêm das finanças do tenant. Os compromissos são gravados no Postgres, na mesma transação do outbox, com vínculo opcional a um lançamento do mês. O Google Calendar permanece desconectado: conectar e sincronizar explicam que a conexão ainda não existe. O browser fala só com o Next.js, que chama o NestJS.

Motivo: a pessoa passa a ver e marcar compromissos na Agenda, junto dos lançamentos do Prumo, sem fingir uma sincronização com o Google.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261007120000_compromissos/`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/financas/financas.module.ts`
- `apps/backend/src/agenda/`
- `apps/frontend/app/agenda/`
- `apps/frontend/app/api/agenda/`
- `apps/frontend/app/api/compromissos/`
- `apps/frontend/components/ui/chip.tsx`
- `apps/frontend/components/ui/page-header.tsx`

## Painel do Assistente fora da Agenda e das Finanças

O que foi feito: o painel do Assistente saiu das telas Agenda e Finanças.

Motivo: a pessoa não quer esse painel nessas duas telas.

Arquivos:

- `apps/frontend/components/ui/app-shell.tsx`

## Lançamento como ponto no calendário

O que foi feito: no calendário, cada lançamento do dia aparece como ponto. Vermelho é saída e verde é entrada. O compromisso continua em chip no desktop. No celular, o compromisso também vira ponto.

Motivo: a pessoa prefere marcar o lançamento por ponto, em vez do nome na célula.

Arquivos:

- `apps/frontend/app/agenda/grade.tsx`

## Pontos na base da célula

O que foi feito: os pontos do calendário ficam na parte inferior da célula. O número do dia e o chip do compromisso permanecem em cima.

Motivo: a pessoa prefere os pontos na base da célula.

Arquivos:

- `apps/frontend/app/agenda/grade.tsx`

## Categoria do compromisso

O que foi feito: cada compromisso tem uma categoria. Único acontece num dia só. Recorrente repete naquele dia, todo mês, e para em dezembro do ano atual. Validade aparece em cada dia de um período, do início ao fim.

Motivo: a pessoa distingue compromisso de um dia, repetição no ano e período de validade.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261007180000_categoria_do_compromisso/`
- `apps/backend/src/agenda/`
- `apps/frontend/app/agenda/`
