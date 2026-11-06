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

## Avisos espertos: gasto do compromisso, vencimentos e tarefas

O que foi feito: depois que um compromisso termina, o sistema pergunta "Teve gasto?". A pergunta aparece na Hoje, num grupo próprio, com o campo de valor, a sessão (a do compromisso, ou um seletor quando ele não tem) e os botões "Lançar" e "Não teve"; e sai como notificação do tipo novo "Gastos dos compromissos" nas três horas depois do fim, levando para a Hoje. Lançar cria um lançamento único de saída, já pago no dia do compromisso (`POST compromissos/:id/gastos`); "Não teve" só responde (`POST compromissos/:id/sem-gasto`). A resposta fica em `appointment_spendings`, uma por compromisso e dia, e a pergunta não volta. Não pergunta quando já há gasto na sessão do compromisso naquele dia, quando o compromisso é o lembrete de um lançamento, nem quando a pessoa desmarca "Perguntar se teve gasto quando terminar" no diálogo do compromisso (`appointments.ask_spending`). O compromisso do dia todo só pergunta se tiver sessão de gastos, às 20h. As perguntas de ontem continuam na Hoje, para o compromisso da noite ser respondido de manhã. Os vencimentos ganharam o aviso da véspera (só saída) e o do atraso: no dia seguinte ao vencimento e uma vez por semana no primeiro mês, para a saída não marcada como paga e para a entrada não marcada como recebida, levando para a Hoje. E às 20h sai o aviso das tarefas que ficaram abertas no dia (tipo novo "Tarefas"). O assistente ganhou `registrar_gasto_do_compromisso` e `sem_gasto_no_compromisso`, e `criar_compromisso` aceita `askSpending`.

Motivo: o sistema deve lembrar a pessoa de registrar o que gastou num compromisso e avisar antes e depois do que vence, sem esperar que ela abra a tela.

Verificação: 486 testes no backend (pergunta de gasto, vencimento de amanhã, atraso, tarefas da noite), 60 no agents e 12 no mobile; tsc e lint limpos; a migração aplicada pelo backend ao subir; os 5 E2E passando. No navegador, em 1280 e 375 px, com três compromissos de hoje que já tinham terminado: os dois com a pergunta ligada aparecem em "Teve gasto?" e o desligado não; digitar 42,50 e "Lançar" cria o lançamento único pago na sessão do compromisso e a pergunta some; sem sessão, aparece o seletor numa linha própria e "Lançar" fica desabilitado até escolher; "Não teve" tira a pergunta; sem rolagem horizontal. A varredura, rodada no contexto do backend, monta o aviso "Teve gasto em …?" para a Hoje e roda sem erro. Não verificado: a notificação gravada para um usuário, porque no ambiente local sem login os dados ficam num tenant sem usuário e a varredura só avisa usuários; no Railway, com login, o tenant tem usuários. Também não verificado: o mobile chamando as rotas reais (o grupo foi conferido com respostas simuladas).

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma` e `migrations/20261107090000_gasto_do_compromisso/`
- `apps/backend/src/agenda/dominio/pergunta-de-gasto.ts` e spec (novos), `aplicacao/agenda.service.ts`, `agenda.controller.ts`, `portas/agenda-repositorio.ts`, `adaptadores/prisma-agenda-repositorio.ts`
- `apps/backend/src/notificacoes/dominio/avisos.ts` e spec, `aplicacao/varredura.service.ts`, `notificacoes.module.ts`
- `apps/backend/src/hoje/aplicacao/hoje.service.ts` e spec
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- specs com compromisso de exemplo: `agenda/aplicacao/ocorrencias.spec.ts`, `painel/dominio/avisos.spec.ts`, `painel/dominio/montar.spec.ts`
- `apps/frontend/app/api/compromissos/[id]/gastos/` e `sem-gasto/` (novos), `app/hoje/page.tsx`, `app/agenda/page.tsx`

## Pergunta de gasto no mobile

O que foi feito: a Hoje do app ganhou o grupo "Teve gasto?" no topo, com o valor, a sessão (ou o seletor, sem sessão no compromisso), "Lançar" e "Não teve", pelas mesmas rotas do web; a notificação de destino "hoje" abre `/inicio/hoje`. O seletor do app deixou de usar a classe `vazio`, que colidia com a caixa tracejada de lista vazia e esticava o campo.

Motivo: a notificação chega no celular, e a resposta precisa caber ali.

Arquivos:

- `apps/mobile/src/paginas/Hoje.tsx`, `paginas/hoje/dia.ts` e spec
- `apps/mobile/src/notificacoes/destino.ts`
- `apps/mobile/src/componentes/Selecao.tsx`
