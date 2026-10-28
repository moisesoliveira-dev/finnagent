# Base de finanças

## Base de Finanças por mês e sessão

O que foi feito: a visão Base deixou de listar todas as transações e passou a mostrar um mês por vez, com os grupos e as sessões do mês.

- **Faixa de meses:** de Mar a Dez, com sublinhado azul que desliza. Começa no mês de hoje; se ele estiver fora do workflow, o backend corrige. Saíram "Todos os meses" e o filtro de dia. Ficam ano, grupo, categoria e busca.
- **Grupos:** viram blocos que abrem e fecham, cada um com a soma.
- **Sessões:** ficam dentro do grupo, com a quantidade de lançamentos e a soma, sem contar cancelado e estornado.
- **Modal da sessão:** clicar numa sessão abre um modal com os lançamentos do mês, onde se edita e se exclui. Ao editar, o modal fecha e abre o formulário.
- **Motion:** deslize na troca de mês, grupos que abrem animados, sessões em cascata e lista esmaecida enquanto carrega.

Motivo: a Base listava todas as transações de uma vez, o que ficava longo; agrupar por mês, grupo e sessão deixa a leitura curta.

Como foi verificado: tsc e eslint limpos; Docker reconstruído; capturas em 1440 e 375 px sem rolagem horizontal. Setembro agrupa 88 linhas em uma sessão.

Arquivos:

- `apps/frontend/app/financas/tabela.tsx`
