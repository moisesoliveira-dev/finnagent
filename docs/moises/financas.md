# Finanças

## Tenant, porta de grupos e visual

O que foi feito: `entry_amounts` ganhou `tenant_id`. A foreign key passou a amarrar (`tenant_id`, `entry_id`) em `entries` (`tenant_id`, `id`). A migration é `20261006203000_valor_do_lancamento_por_tenant`. Leituras de valores filtram o tenant. O semeio de finanças deixou de gravar grupo e sessão direto no Prisma. O serviço de finanças usa a porta `GruposRepositorio`. O repositório de finanças só grava workflow e lançamento. `PrismaService`, o publicador do outbox e `gravarOutbox` saíram da slice de grupos e foram para `apps/backend/src/persistencia`. `GruposModule` exporta a porta de grupos. O controller de finanças usa `TIPOS_LANCAMENTO` de `@finnagent/contracts`, sem a lista duplicada. Money usa peso 500 na linha e na faixa, e 600 na linha de grupo e no rodapé. A tabela Base tem largura mínima de 880 px e rola no contêiner.

Motivo: alinhar tenant, a porta de grupos, o contrato e o visual do Prumo.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261006203000_valor_do_lancamento_por_tenant/migration.sql`
- `apps/backend/src/persistencia/`
- `apps/backend/src/financas/`
- `apps/backend/src/grupos/`
- `apps/backend/src/app.module.ts`
- `apps/frontend/components/ui/money.tsx`
- `apps/frontend/app/financas/tabela.tsx`
- `apps/frontend/app/financas/visao-geral.tsx`

## Lançamentos na aba Finanças

O que foi feito: a aba Finanças passou a ler e gravar lançamentos do tenant. O browser chama o Next em `/api/financas` e `/api/lancamentos`, e o Next chama o Nest. O Nest guarda um workflow por tenant e os lançamentos, com valor em centavos, filtrando pelo tenant. Os tipos são adicional, parcela, empréstimo, fixo e variável. Criar o workflow e o lançamento grava o outbox na mesma transação. Sem grupo, o serviço semeia o exemplo. A tela tem a visão Geral, com os meses a partir do workflow, grupos que abrem e fecham e os totais, e a visão Base, com o mês, filtros e busca. Novo lançamento abre um diálogo e exige sessão. O contrato compartilhado calcula as colunas do ano, o valor de cada mês e os totais. A migration inicial é `20261006180000_lancamentos`.

Motivo: a aba Finanças precisava mostrar e registrar os lançamentos ligados às sessões.

Arquivos:

- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/visao-geral.tsx`
- `apps/frontend/app/financas/tabela.tsx`
- `apps/frontend/app/financas/reais.ts`
- `apps/frontend/app/api/financas/`
- `apps/frontend/app/api/lancamentos/`
- `apps/backend/src/financas/`
- `apps/backend/src/app.module.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261006180000_lancamentos/migration.sql`
- `packages/contracts/src/index.ts`

## Atributos da transação

O que foi feito: o lançamento passou a guardar nome, data, movimento, status, tipo, categoria, prioridade e os dados de parcela, empréstimo e valor fixo. A categoria continua alimentando o tipo que a visão do ano já calcula. Cancelada, estornada, mês cancelado e mês suspenso saem do total. A Base mostra a transação mesmo assim e abre as ações: atualizar status, associar compromisso, adiantar ou cancelar parcelas e empréstimo, cancelar ou suspender um mês fixo e atualizar o valor de uma ou mais transações fixas. Cada comando filtra o tenant e grava o outbox na mesma transação. A migration é `20261010140000_atributos_da_transacao`.

Entrada fica sem prioridade. Parcela e extra são sempre saída e também ficam sem prioridade (`nopriority`). Fixa, parcela e empréstimo são sempre compromisso. A migration `20261010153000_prioridade_e_compromisso` ajusta as transações que já existiam.

A descrição do lançamento é opcional. O movimento define o sinal do valor: entrada positivo, saída negativo. A transação fixa tem recorrência semanal, mensal, trimestral, semestral, anual ou personalizada, com um inteiro de intervalo. A migration é `20261010160000_recorrencia_da_fixa`.

Extra é só entrada e fica sem prioridade. Parcela continua saída e tem prioridade. O lápis abre a edição com os dados já gravados. A migration é `20261010170000_extra_entrada_parcela_prioridade`.

Motivo: a aba Finanças precisava tratar a transação com esses atributos, status e variações.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261010140000_atributos_da_transacao/migration.sql`
- `apps/backend/prisma/migrations/20261010153000_prioridade_e_compromisso/migration.sql`
- `apps/backend/prisma/migrations/20261010160000_recorrencia_da_fixa/migration.sql`
- `apps/backend/prisma/migrations/20261010170000_extra_entrada_parcela_prioridade/migration.sql`
- `apps/backend/src/financas/`
- `apps/frontend/app/financas/`
- `apps/frontend/app/api/lancamentos/`

## Tokens da tela

O que foi feito: o seletor Base/Geral passou a usar `text-brand!` e `text-ink-2!`, porque o CSS base do botão cobria a cor do token. O ícone de editar foi de `size-5` para `size-4`. O checkbox de aplicar valor em outras fixas ganhou `size-4`, `accent-brand` e foco.

Motivo: alinhar a tela aos tokens do Prumo.

Arquivos:

- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/tabela.tsx`
- `apps/frontend/app/financas/acoes.tsx`

## Transação do repositório

O que foi feito: `atualizarValorFixo` conferia o lote no meio da gravação. Um retorno de falha no Prisma confirmava o que já tinha sido alterado e o outbox ficava de fora. Agora a conferência de todos os itens acontece antes de qualquer gravação. Se a linha sumir depois de gravar, a transação é desfeita. O mesmo descarte depois da gravação vale em atualizar, associar compromisso e alterar.

Motivo: mudança de estado e outbox na mesma transação.

Arquivos:

- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`

## Lista no celular

O que foi feito: abaixo de 760 px, a visão Geral e a Base mostram os lançamentos em lista, na largura da tela. Na Geral, o grupo abre e fecha, traz o nome, o total e a soma de cada mês; cada lançamento traz a sessão, o resumo da linha, o total e o valor de cada mês. Entradas, saídas e a sobra do mês também aparecem nessa lista. Na Base, cada item traz a data, o nome, o valor, a categoria, o status, a prioridade, o grupo e a sessão, e, quando existem, a descrição, a parcela e a justificativa, com as ações de editar e excluir e o total no fim. A grade de meses e a tabela da Base continuam a partir do tablet.

Motivo: as colunas fixas cobriam a tabela no celular.

Arquivos:

- `apps/frontend/app/financas/visao-geral.tsx`
- `apps/frontend/app/financas/tabela.tsx`

## A sobra passa de um mês para o outro

- A sobra de um mês que não foi gasta nem separada para metas passa para o mês seguinte. `sobraAcumulada` (contracts) soma a sobra de cada mês desde o início do workflow até o mês pedido; o que foi separado para uma meta é saída na sessão dela, então já está descontado.
- **Metas:** a sobra que as metas disputam (`surplusCents`) passou a ser a deste mês mais o que veio dos meses anteriores (`carriedCents`); `monthSurplusCents` guarda só a do mês. A tela mostra "Sobra até <mês>" e, quando há, "Veio dos meses anteriores". A sugestão de divisão e a aprovação partem da acumulada.
- **Dashboard:** o painel traz `sobraAcumulada` (até o fim do período) e mostra "Acumulada desde o início" abaixo da sobra do período quando for diferente dela.
- **Assistente:** o resultado de `consultar_mes_financeiro` traz a acumulada, e o consultor sabe que "quanto tenho livre" é ela.

Motivo: a sobra de um mês não some no mês seguinte; é o que a pessoa realmente tem para gastar ou guardar.

Verificação: tsc e lint limpos nos quatro apps; 439 testes no backend (novo: a acumulada por mês e com separação para meta), 60 no agents. Não verificado: a tela de Metas e o Dashboard no navegador com dados de vários meses (só pelo tipo e pelos testes).

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/metas/aplicacao/metas.service.ts`
- `apps/backend/src/financas/dominio/regras.spec.ts`
- `apps/backend/src/notificacoes/dominio/avisos.spec.ts`
- `apps/backend/src/assistente/dominio/resultados.ts`
- `apps/agents/src/assistente/dominio/consultor.ts`
- `apps/frontend/app/page.tsx` e `app/metas/page.tsx`

## Campos de dinheiro só com número e a lista da Agenda

- **Campos de valor:** todo campo que pede dinheiro usa o `CampoValor`: só aceita dígitos e mostra o valor já em reais ("1.234,56"), com os centavos entrando pela direita. Entraram nele o saldo inicial da conta, o valor da ocorrência na lista de ocorrências e o valor de cada parte na divisão da Conferência. O `CampoValor` passou a aceitar os atributos comuns de input (`aria-label`, `disabled`, `onBlur`). O campo de juros (%) do lançamento aceita só dígitos e uma vírgula.
- Na divisão da Conferência, o valor da parte deixou de aceitar uma conta digitada ("120,50 / 2"); a calculadora continua no diálogo e o botão "Calculadora" leva o resultado para a parte.
- **Agenda, visão em lista:** virou uma lista única, um bloco por dia. O dia fica à esquerda, com o número grande e o dia da semana (em azul quando é hoje, com o chip "Hoje"); à direita, uma linha por feriado e por item: a hora numa coluna fixa, o ponto colorido da legenda de camadas, o título, os detalhes em texto (grupo › sessão, agenda, repetição, lugar) e, à direita, o valor com a situação. Só a situação vira chip. Antes, cada dia era um título solto com chips colados, e o item repetia três chips que empilhavam no celular.

Motivo: valor digitado com letra ou formato livre dava erro só ao salvar, e a lista da Agenda não tinha estrutura de lista.

Verificação: tsc e lint limpos no frontend; no navegador, o saldo inicial digitado como "abc12x3456" virou "1.234,56"; a Agenda em lista em 1280 px claro e 375 px escuro, sem rolagem horizontal, com feriado, lançamento atrasado, compromisso com hora e lugar e o dia de hoje. Não verificado: o mobile (não tem campo de valor).

Arquivos:

- `apps/frontend/app/financas/campo-valor.tsx`, `contas.tsx`, `ocorrencias.tsx` e `page.tsx`
- `apps/frontend/app/extratos/conferencia/divisao.tsx`
- `apps/frontend/app/agenda/lista.tsx`, `feriados.tsx` e `itens.ts`

## Parcela com pagamento livre e empréstimo como contrato

O que foi feito:

- **Pagamento como ato real.** Parcela e empréstimo deixam de ser pagos "pela ocorrência do mês": o pagamento tem data e valor reais e vai para o que ainda falta. O motor é `financas/dominio/pagamento.ts` (`aplicarPagamento`, `desfazerPagamento`, `replanejarEmprestimo`). A ocorrência ganhou `kind` (parcela ou multa), `parcel` (o número da parcela do contrato) e `paymentId` (quem a pagou), na migração `20261105160000_pagamentos_de_serie`.
- **Parcela:** o valor vai para a primeira pendente, em qualquer mês (adiantado ou atrasado). O que passar paga as seguintes. Sobra menor que uma parcela é multa e juros (ocorrência "multa", na mesma sessão) ou parte da próxima, conforme a pessoa escolher; menos que a parcela paga parte dela e o restante fica pendente com o mesmo vencimento e número. Duas no mesmo mês, pagas juntas ou separadas, funcionam.
- **Empréstimo:** virou contrato, com pessoa (`counterparty`) e total combinado (`principalCents`); o valor do lançamento é a parcela combinada, só como previsão. Cada pagamento vira uma ocorrência paga na data e o que falta é previsto de novo a partir do mês seguinte, até o saldo zerar. Mês sem pagamento empurra a previsão no pagamento seguinte. Vencimento e juros deixaram de ser obrigatórios. Os empréstimos antigos viraram contratos na migração (total = prestação × parcelas).
- **Mês contábil:** a ocorrência paga conta no mês do pagamento; a pendente, no do vencimento (`dataContabil`). Vale no painel, na sobra, na agenda, na Base, nos fatos do plano e na leitura por mês do repositório.
- **Conferência:** parcela e empréstimo aparecem como candidatos em qualquer mês enquanto têm parcela pendente, então a linha do mês seguinte, lembrada pelo nome, já propõe o cruzamento com a série. A linha paga o que falta no valor dela; quando passa da parcela, a tela pergunta se a sobra é multa e juros ou parte da próxima (`diferenca`). Só a fixa continua perguntando "extrato ou lançamento". Desfazer a linha desfaz exatamente o que ela pagou, pelo id do pagamento da linha (`idDoPagamentoDaLinha`). O tipo "Empréstimo" na linha pede a pessoa e o total.
- **Finanças:** bloco "Empréstimos" (Devo / Me devem) com total, pago, falta e próximo previsto, e os botões Pagar, Quitar e Desfazer último pagamento. Nas parcelas, "Adiantar" virou "Pagar" (data e valor) e "Quitar". A Base marca "Multa e juros". O formulário do empréstimo pede Pessoa e Total combinado no lugar de Vencimento e Juros.
- **API:** `POST lancamentos/:id/pagamentos` e `DELETE lancamentos/:id/pagamentos/:paymentId`; `cruzamentos` aceita `diferenca`. **Assistente:** `registrar_pagamento`, `cruzar_linha` com `diferenca`, e o prompt explica parcela e empréstimo.
- O recorrente não mudou: a regra de vencimento (manter, antecipar, adiar, adiar no mês) já cobre o dia útil.

Motivo: o empréstimo informal e a parcela da vida real não seguem um cronograma rígido: pagam duas num mês, atrasam com multa, quitam de uma vez.

Verificação: 460 testes no backend (14 novos do motor de pagamentos: adiantar, duas num mês, parte, multa ou próxima, quitar e sobrar, desfazer, e o empréstimo com saldo, mês sem pagamento e quitação), 60 no agents; tsc e lint limpos nos quatro apps; a migração aplicada no Postgres local e o diff contra o schema vazio. Pela API local: parcela de 4 paga duas de uma vez em novembro, a terceira com multa pede a escolha e grava a multa, a agenda e a Base mostram no mês do pagamento, desfazer volta a multa junto; empréstimo de 1.000 sem pagamento em outubro, 50 em novembro empurra a previsão, quitação em dezembro deixa só os dois pagamentos; a linha de janeiro do extrato propõe a parcela de dezembro, cruza e desfaz. No navegador, em 1280 e 375 px: o bloco Empréstimos e o diálogo de pagamento, sem rolagem horizontal. Não verificado: o assistente usando registrar_pagamento com o modelo real; o mobile na Conferência com a sobra da parcela (ele mostra a mensagem do backend).

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma` e `migrations/20261105160000_pagamentos_de_serie/`
- `apps/backend/src/financas/dominio/pagamento.ts` (reescrito) e `pagamento.spec.ts` (novo), `pedido.ts`, `pedido.spec.ts`, `vista.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`, `portas/financas-repositorio.ts`, `aplicacao/financas.service.ts`, `financas.controller.ts`
- `apps/backend/src/extratos/dominio/cruzar.ts`, `pagamento-da-linha.ts` (novo), `aplicacao/extratos.service.ts`, `extratos.controller.ts`, specs
- `apps/backend/src/agenda/dominio/lancamentos-do-mes.ts`, `assistente/dominio/fatos-do-plano.ts`, `assistente/adaptadores/rotas-das-ferramentas.ts`, `dados/dominio/pacote.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/financas/pagamento.tsx` (novo), `emprestimos.tsx` (novo), `page.tsx`, `acoes.tsx`, `tabela.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx` e `tipo-da-linha.tsx`
- `apps/frontend/app/api/lancamentos/[id]/pagamentos/` (novo)
