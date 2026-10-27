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

## Dashboard com destaque, gráfico e movimento

O que foi feito: a tela do dashboard foi refeita com `motion`. Um bloco de destaque mostra a "Sobra do período" com o valor contando do zero até o final, uma barra de entradas contra saídas que cresce da esquerda e a frase de quanto das entradas viram saída; ao lado, uma grade 2×2 com Entradas, Saídas (também contam), Compromissos e Lançamentos. No ano há o gráfico "Sobra por mês" (12 barras) e a tabela por mês; no mês há o gráfico "Saldo por dia" e a lista por dia com o número grande do dia, o dia da semana e a marca "Hoje". As barras sobem em verde (sobra) e descem em vermelho (falta) ao redor de uma linha de zero, crescem em sequência e são botões: apontar ou focar mostra o valor, clicar abre o mês ou o dia. Os blocos, os avisos e as linhas das listas entram em cascata. A barra de controles (período, navegação e "Hoje") ficou em um quadro com borda. Com movimento reduzido, não há contagem nem crescimento: os valores finais aparecem de uma vez, e o leitor de tela lê só o valor final. Peças novas em `components/ui/`: `Contador` (dinheiro que conta, com o mesmo sinal e cor do `Money`) e `Barras` (gráfico de saldo); `List` e `ListRow` ganharam os opcionais `animada` e `animado`; `money.tsx` exporta `textoDoValor` e `tomDoValor`. O aviso de linhas de extrato sem lançamento continua, agora animado.

Motivo: dar ao dashboard leitura rápida do que sobra e do que pesa, com aparência profissional e sem sair dos tokens e das peças de movimento do projeto.

Arquivos:

- `apps/frontend/app/page.tsx`
- `apps/frontend/components/ui/contador.tsx`
- `apps/frontend/components/ui/barras.tsx`
- `apps/frontend/components/ui/list.tsx`
- `apps/frontend/components/ui/list-row.tsx`
- `apps/frontend/components/ui/money.tsx`
