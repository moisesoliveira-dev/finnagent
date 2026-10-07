# Dashboard

O que foi feito: a aba Hoje passou a se chamar Dashboard e continua na rota `/`. Abre no dia de hoje, com entradas, saídas, sobra, compromissos e lançamentos desse dia. Dá para alternar o período entre Data, Mês e Ano. Na data há um campo de calendário e as setas andam um dia. No mês, as setas andam um mês e cada dia com item abre essa data. No ano, os doze meses aparecem e o nome do mês abre aquele mês. Os meses anteriores ao início do workflow não entram na soma. Um botão Hoje, Este mês ou Este ano volta ao período atual. O cálculo é `montarPainel` em `packages/contracts`, testado no backend. O Nest lê finanças e as ocorrências da agenda, filtra o tenant e não grava outbox nem tabela nova. O browser chama `/api/painel`. O assistente não aparece no Dashboard. Ajustes saiu do menu lateral. Não há variável de ambiente nova.

Motivo: a pessoa quer ver o dia de hoje e poder trocar a leitura para uma data, um mês ou um ano.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/painel/`
- `apps/backend/src/agenda/aplicacao/agenda.service.ts`
- `apps/backend/src/agenda/agenda.module.ts`
- `apps/backend/src/app.module.ts`
- `apps/frontend/app/page.tsx`
- `apps/frontend/app/api/painel/route.ts`
- `apps/frontend/components/ui/app-shell.tsx`
