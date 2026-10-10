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

## Atributos do compromisso

O que foi feito: o calendário (Pessoal e Trabalho) passou a ter fuso, com padrão America/Sao_Paulo. O compromisso guarda título, descrição, local, início, fim, dia todo e status `done` ou `undone`. A categoria ficou `fixed` (uma vez), `periodical` (o mesmo dia, todo mês) e `time` (o mesmo dia, todo mês, até a validade). A tela mostra o fuso, o formulário novo e o botão de cumprido ou descumprido. Cada comando filtra o tenant e grava o outbox na mesma transação. A migration é `20261010180000_atributos_do_compromisso` e converte único, recorrente e validade antigos.

Motivo: a agenda passa a descrever o compromisso com horário, lugar, fuso e se ele foi cumprido.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261010180000_atributos_do_compromisso/`
- `apps/backend/src/agenda/`
- `apps/frontend/app/agenda/`
- `apps/frontend/app/api/agenda/sincronizar/`
- `apps/frontend/app/api/calendarios/`
- `apps/frontend/app/api/compromissos/[id]/status/`
- `apps/backend/src/painel/dominio/montar.spec.ts`

## Sincronizar o Google Agenda

O que foi feito: `sincronizarGoogleCalendar` recebe os compromissos do Google e grava ou atualiza os que já existem, na mesma transação do outbox, sem mexer no status de cumprimento. Sem conexão, o comando responde para conectar o Google Calendar e não inventa eventos.

Motivo: a sincronização fica no sistema, e só grava compromisso quando o Google devolve eventos.

Arquivos:

- `apps/backend/src/agenda/dominio/sincronizar.ts`
- `apps/backend/src/agenda/portas/google-agenda.ts`
- `apps/backend/src/agenda/adaptadores/google-agenda-desconectada.ts`
- `apps/backend/src/agenda/adaptadores/prisma-agenda-repositorio.ts`
- `apps/frontend/app/api/agenda/sincronizar/route.ts`
- `apps/frontend/app/agenda/page.tsx`

## Revisão visual da agenda

O que foi feito: os campos da agenda passaram de `min-h-11` para `min-h-10`. Os dias da lista usam `gap-8` e o título `gap-3`, no lugar de margem. A linha usa `List`, com título, descrição, local e chips em `gap-1`. O ponto de desconexão e os das camadas ficaram em `size-2`, com `gap-2`.

Motivo: alinhar a tela aos tokens do Prumo.

Arquivos:

- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/agenda/lista.tsx`
