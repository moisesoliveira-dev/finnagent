# Eventos

O que foi feito: a tela Eventos é uma leitura de depuração da outbox real do tenant. Não há catálogo de eventos de exemplo nem segunda tabela de eventos. A outbox ganhou `occurred_at` (default now) na migration `20261008120000_ocorrido_do_evento` e no model Outbox. Os registros antigos ficam com o horário da migration. `gravarOutbox` continua sem passar o campo, porque o banco preenche. O contrato ganhou o catálogo de categorias (financeiro, agenda, extratos, agente, sistema), os tipos Evento, HistoricoEvento e EventosResposta, e a função pura `montarEventos`. Ela classifica a operação, deriva o status (pendente se ainda não publicado, processando se publicado e não consumido, concluído se consumido), mascara payload sensível e monta o histórico a partir de `consumed_events`. Correlação e causação voltam nulas. A origem é importação só em `importar-extrato` e `reprocessar-extrato`; o resto é sistema. O consumidor real é "Publicar outbox". O status com falha existe no contrato da tela, mas a outbox ainda não grava falha e não há reprocessamento. O backend tem a slice hexagonal em `apps/backend/src/eventos`: porta, adaptador Prisma filtrado por tenant, serviço, controller GET `/eventos` e módulo. `EventosModule` entrou no app. O teste está em `montar.spec.ts`. O browser chama `/api/eventos`. A tela em `/eventos` tem visão Eventos e Histórico, chips de categoria, filtros, diálogo de detalhes e diálogo de categorias. Os campos têm 40 px, o chip de categoria inativo fica em ink-2 e o ativo em brand, a última linha da tabela fica sem borda, e o diálogo de detalhes só abre depois que o título está no DOM. O item Eventos entrou no menu depois de Relatórios e antes de Extratos. O assistente fica oculto em `/eventos`. `prumo-eventos.html` ficou fora do Git; é só referência de UI.

Motivo: a pessoa precisa inspecionar os fatos já gravados na outbox e o que o publicador consumiu, sem inventar outro registro de eventos.

Arquivos:

- `apps/backend/prisma/migrations/20261008120000_ocorrido_do_evento/migration.sql`
- `apps/backend/prisma/schema.prisma`
- `packages/contracts/src/index.ts`
- `apps/backend/src/eventos/`
- `apps/backend/src/app.module.ts`
- `apps/frontend/app/api/eventos/route.ts`
- `apps/frontend/app/eventos/page.tsx`
- `apps/frontend/components/ui/app-shell.tsx`
