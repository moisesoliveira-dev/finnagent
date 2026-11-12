# Parcelas pagas no mesmo mês

## Duas parcelas no mesmo mês, na mesma transação ou em transações diferentes

O que foi feito: o sistema passou a dizer, antes de pagar, quantas parcelas um valor cobre, e a tratar duas parcelas do mesmo mês nas telas de pagamento, na Conferência e na série.

- **Conta compartilhada:** `planoDoPagamentoDeParcelas`, `pendentesDaSerie` e `fraseDoPlanoDeParcelas` em `packages/contracts`. Dizem quantas parcelas inteiras o valor paga, quanto sobra e se a sobra pede a escolha entre multa e parte da próxima. Um teste confere que a conta concorda com o motor do backend (`pagarParcelas`) em dezenas de combinações.
- **Pagamento da parcela (web, web no celular e app):** atalho "1, 2 ou 3 parcelas" que preenche o valor, frase "Paga 2 parcelas (R$ a + R$ b)", e a pergunta da sobra só aparece quando sobra algo e ainda há outra parcela. Antes, o valor de exatamente duas parcelas pedia a escolha sem necessidade.
- **Conferência:** o candidato de uma parcela traz o valor de cada parcela pendente (`pendentes`), e a tela diz quantas parcelas a linha paga. Duas linhas do mesmo mês, cada uma paga a próxima pendente, e uma linha de duas parcelas paga as duas. Empréstimo deixou de pedir a sobra, porque o backend não usa a escolha nele.
- **App, Conferência:** ganhou a pergunta da sobra (multa ou parte da próxima), que só existia no site, e deixou de perguntar "qual valor vale?" para parcela e empréstimo (o backend ignora a resposta; só a recorrente pergunta, como no site).
- **Série (a mesma compra em vários meses):** em parcela e empréstimo, duas linhas do mesmo mês podem pagar duas parcelas. Antes o backend recusava ("só uma linha paga a série") e a segunda linha virava outra transação, deixando a parcela dela pendente no contrato. A tela ganhou "Cada uma paga uma parcela", ao lado de "Somar no mês" e "Só uma". No app, a série passou a ter as três opções (antes só somava). Por padrão, linhas de mesmo valor no mês entram como parcelas.

Motivo: pagar duas parcelas no mesmo mês, em uma ou duas transações, é comum, e as telas tratavam como se fosse uma por mês.

Como foi verificado: 553 testes do backend (novos em `pagamento.spec`, `serie.spec` e `cruzar.spec`), 20 do app e 6 do `packages/chat`; `tsc` do web e do app. As telas não foram exercitadas com dados reais.

Limites conhecidos: o número da parcela mostrado por mês na série nova supõe uma parcela por mês; com duas no mesmo mês, os rótulos dos meses seguintes podem ficar uma parcela atrás (o pagamento em si não depende do rótulo). A visão "Parcela N/total" da tabela de lançamentos do web não foi revisada para dois pagamentos no mesmo mês.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/extratos/dominio/{cruzar,serie}.ts` e os `.spec.ts` deles
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/financas/dominio/pagamento.spec.ts`
- `apps/frontend/app/financas/pagamento.tsx`
- `apps/frontend/app/extratos/conferencia/{page,serie}.tsx`
- `apps/mobile/src/paginas/financas/DetalheDoLancamento.tsx`
- `apps/mobile/src/paginas/extratos/{Conferencia,Serie}.tsx`

## Editar uma ocorrência específica no app

O que foi feito: no detalhe do lançamento do app, cada ocorrência pendente ganhou o lápis. Ele abre, só para aquela ocorrência, o vencimento e o valor previsto, e "Pagar em" para pagar numa data escolhida (antes só pagava com a data de hoje). A ocorrência do mês que está aberto em Finanças ganhou a etiqueta "Neste mês", e a que já foi paga depois do vencimento mostra "Venceu em...".

Mudança de regra no backend: a ocorrência **pendente** passa a ser editável mesmo no lançamento que já tem linha do extrato (antes, qualquer lançamento conciliado travava a data e o valor de todas as ocorrências). A paga, cancelada ou estornada continua travada. Vale também para o site, que usa a mesma informação (`editable`).

Motivo: as linhas do extrato pagam ocorrências, que viram pagas e não mudam; a pendente não tem linha ligada, então editá-la não desfaz nada do que foi conciliado. O pedido era mudar a data de uma ocorrência de um seguro com parcelas já conferidas.

Como foi verificado: 95 testes de finanças do backend, com um teste novo (pendente editável no lançamento conciliado, paga não). O lápis no app ainda não foi exercitado.

Arquivos:

- `apps/backend/src/financas/dominio/vista.ts` e `vista.spec.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/mobile/src/paginas/financas/DetalheDoLancamento.tsx`
- `apps/mobile/src/tema/tema.css`
