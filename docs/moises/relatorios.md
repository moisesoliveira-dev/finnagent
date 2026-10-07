# Relatórios

O que foi feito: a aba Relatórios lê os lançamentos do ano e mostra entradas, saídas e sobra. Os meses visíveis começam no workflow. Dá para avançar o ano; o ano anterior ao workflow fica bloqueado. Por grupo, a lista ordena pela maior saída e mostra a parte das saídas do ano. Por tipo, mostra adicional, parcela, empréstimo, fixo e variável quando há valor. O cálculo é `montarRelatorio` em `packages/contracts`, testado no backend. O Nest só lê o que o serviço de finanças já devolve. Não há tabela nova, outbox nem variável de ambiente. O browser chama `/api/relatorios` e o Next chama o Nest. O item Relatórios fica depois de Metas e antes de Extratos. O assistente fica oculto em `/relatorios`.

Motivo: a pessoa precisa ver, fora da grade de lançamentos, para onde foi o dinheiro do ano.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/relatorios/`
- `apps/backend/src/app.module.ts`
- `apps/frontend/app/relatorios/page.tsx`
- `apps/frontend/app/api/relatorios/route.ts`
- `apps/frontend/components/ui/app-shell.tsx`
