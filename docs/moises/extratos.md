# Extratos

## Importações

O que foi feito: a aba Importações recebe arquivo OFX ou CSV de até 5 MB, ligado a uma conta. CSV pede o mapeamento das colunas. A tela mostra o resumo, o histórico, as linhas, o reprocessamento e a exclusão. O conteúdo das linhas não entra no outbox.

Motivo: a pessoa passa a guardar e revisar os extratos enviados.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261007210000_extratos/`
- `apps/backend/src/extratos/`
- `apps/backend/src/main.ts`
- `apps/backend/src/app.module.ts`
- `apps/frontend/app/extratos/`
- `apps/frontend/app/api/extratos/`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/components/ui/button.tsx`
- `apps/frontend/components/ui/chip.tsx`

## Menu de Extratos

O que foi feito: o menu lateral de Extratos tem duas entradas. Importações gerencia e adiciona os arquivos. Conferência mostra as linhas lidas, sugere o lançamento de mesmo valor e dia próximo, e a pessoa confirma no painel IA.

Motivo: a pessoa separa o envio do arquivo da revisão e do cruzamento.

Arquivos:

- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/app/extratos/`
- `apps/frontend/app/api/extratos/`
- `apps/backend/src/extratos/`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261007223000_cruzamento_da_linha/`
- `packages/contracts/src/index.ts`

## Foto e PDF

O que foi feito: a importação aceita foto e PDF. O Nest chama o agents, grava as linhas e a prévia aparece na tela. OFX e CSV continuam no backend.

Motivo: a pessoa precisa enviar foto ou PDF do extrato e ver as linhas na tela, com OFX e CSV ainda lidos no backend.

Arquivos:

- `apps/frontend/app/extratos/page.tsx`
- `apps/backend/src/extratos`

## Cruzamento seguro, desfazer e deduplicação

O que foi feito: se o pagamento falha depois de cruzar, o cruzamento é desfeito (em "Acumular" o lançamento criado também é removido). Novo "Desfazer cruzamento" (`POST /extratos/cruzamentos/desfazer` no backend e no BFF, com botão nas linhas cruzadas): a linha volta a "sem lançamento", a ocorrência volta a pendente e o compromisso do mês volta a "não feito". Pagar pelo extrato marca como feito o compromisso ligado ao lançamento no mês. Reprocessar ou excluir um extrato com linha cruzada é recusado, com mensagem para desfazer antes. Linhas iguais (data, valor, descrição) já gravadas em outro extrato da mesma conta são ignoradas com aviso; o mesmo arquivo na mesma conta é recusado, inclusive no OCR. Sessão de valor já lançada deixou de aparecer como destino em "Acumular". Mensagem "Adicional só cruza com entrada.".

Motivo: evitar ocorrência paga sem origem, permitir corrigir um cruzamento errado e impedir linhas duplicadas.

Arquivos:

- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/extratos/extratos.controller.ts`
- `apps/backend/src/extratos/dominio/cruzar.ts`
- `apps/backend/src/extratos/dominio/repetidas.ts`
- `apps/backend/src/extratos/dominio/repetidas.spec.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `apps/frontend/app/api/extratos/cruzamentos/desfazer/route.ts`
- `apps/frontend/app/extratos/conferencia/page.tsx`

## Integração obrigatória e compromisso que acumula gastos

O que foi feito:

- A Conferência diz quando o mês está conferido: só quando há linhas e todas têm lançamento (campo `checked`). Enquanto sobrar linha sem lançamento, mostra o aviso de que cada uma precisa de lançamento ou sessão. O dashboard ganhou `semConferir` (linhas do período sem lançamento, mês ou ano) com aviso e atalho "Conferir agora"; nada trava a navegação.
- O compromisso da agenda ganhou `session_id` (migração `20261028120000_sessao_do_compromisso`, FK com `ON DELETE SET NULL`): só sessão aberta do tipo acúmulo é aceita. O formulário tem "Sessão que acumula os gastos"; o dia mostra "Acumula · Grupo / Sessão" e o total já pago na sessão naquele dia (`spentCents`).
- Na Conferência, linha sem relação em dia com compromisso que tem sessão vem com essa sessão sugerida e o selo "Compromisso: título". O nome já lançado antes vale mais; se dois compromissos do dia apontam para sessões diferentes, não há sugestão.
- Exportar e importar dados leva a sessão do compromisso; pacotes antigos continuam importando.
- Migração aplicada só no Postgres local do Compose.

Motivo: toda linha do banco precisa terminar integrada a um lançamento ou sessão, e gastos que se somam (uma saída, as corridas de um dia) acumulam no compromisso daquele dia.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261028120000_sessao_do_compromisso/migration.sql`
- `apps/backend/src/agenda/agenda.controller.ts`
- `apps/backend/src/agenda/agenda.module.ts`
- `apps/backend/src/agenda/aplicacao/agenda.service.ts`
- `apps/backend/src/agenda/adaptadores/prisma-agenda-repositorio.ts`
- `apps/backend/src/agenda/portas/agenda-repositorio.ts`
- `apps/backend/src/agenda/dominio/gasto.ts`
- `apps/backend/src/agenda/dominio/gasto.spec.ts`
- `apps/backend/src/agenda/aplicacao/ocorrencias.spec.ts`
- `apps/backend/src/extratos/extratos.module.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/extratos/dominio/sessao-do-compromisso.ts`
- `apps/backend/src/extratos/dominio/sessao-do-compromisso.spec.ts`
- `apps/backend/src/painel/painel.module.ts`
- `apps/backend/src/painel/aplicacao/painel.service.ts`
- `apps/backend/src/painel/dominio/avisos.spec.ts`
- `apps/backend/src/painel/dominio/montar.spec.ts`
- `apps/backend/src/dados/dominio/pacote.ts`
- `packages/contracts/src/index.ts`
- `apps/frontend/app/page.tsx`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/agenda/itens.ts`
- `apps/frontend/app/agenda/lista.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`

## Lista de sessões da Conferência por cima das linhas

O que foi feito: na Conferência do web, a lista do campo "Pesquisar a sessão" passou a ser renderizada por `createPortal` no `body`, em `position: fixed` e `z-50`. Um `useLayoutEffect` escreve a posição direto no estilo do elemento, sem estado, colada no campo, e recalcula em resize e scroll. A lista abre para cima quando falta espaço embaixo, o clique fora considera a lista e a opção marcada pelo teclado entra na vista.

Motivo: a lista era `absolute` dentro da linha, e cada linha é um `ItemAnimado` (`layout=position`, `whileHover x:2`) que o Motion põe em contexto de empilhamento próprio, então a linha seguinte cobria a lista e o mouse acertava a linha, que balançava e roubava hover e clique.

Verificado no navegador (tema escuro, 1280 px): lista no `body` com fixed e z 50, ponteiro caiu na lista nas 3 opções, nenhuma linha deslocada no hover, clique e teclado escolhem a sessão, a lista acompanha o campo ao rolar. Não verificado: lista longa com rolagem interna (o banco de teste só tem 3 sessões).

Arquivos:

- `apps/frontend/app/extratos/conferencia/busca-sessao.tsx`

## Sessão Fixo na Conferência: cruza com a transação e fecha

O que foi feito: ao acumular uma linha numa sessão Fixo que já tem a transação dela (lançada à mão), a Conferência passou a cruzar a linha com essa transação em vez de criar outra. Um modal mostra a conta (o que a sessão já soma, o valor da linha e o total se somar) e pergunta: usar o do extrato, manter o lançado, somar como mais uma parte (pagamento que veio quebrado) ou deixar assim por enquanto, que não grava nada. Com valores iguais, o modal só pede para confirmar o cruzamento. Resolvida a linha, a sessão não recebe outra sem a escolha de somar como parte. As sessões Fixo já lançadas passaram a aparecer na lista, marcadas "Fixo já lançado". No lote, a linha de sessão Fixo já lançada fica de fora e a tela avisa quantas foram, porque pede a confirmação no modal da própria linha. A lista de sessões recarrega depois de cada lançamento, para a Fixo passar a "já lançado" na hora. Sessão de acúmulo não mudou: cada linha segue virando um lançamento único e pago por trás, o que mantém painel e relatórios corretos.

Motivo: a sessão Fixo guarda uma única transação, e a Conferência ou escondia a sessão quando já estava lançada ou falhava com "Esta sessão fixa já foi lançada" sem comparar valores.

Verificação: `tsc` limpo no backend e no frontend; 138 testes dos módulos extratos, finanças e grupos passam, com 6 casos novos (valores iguais, divergentes, escolha, sessão já conciliada, "paga em partes") e a regra `valorDaSessaoFixa` testada. Não verificado: a tela no navegador e o Docker, que não foi reconstruído. O mobile segue escondendo as sessões Fixo já lançadas, sem o novo fluxo. Vale em produção depois do deploy de `frontend` e `backend`.

Arquivos:

- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.lote.spec.ts`
- `apps/backend/src/extratos/dominio/cruzar.ts`
- `apps/backend/src/extratos/dominio/cruzar.spec.ts`
- `apps/backend/src/extratos/extratos.controller.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/frontend/app/extratos/conferencia/page.tsx`

## Transferência para pessoa não é lembrada

O que foi feito: a Conferência deixou de lembrar a sessão (e o lançamento) de linhas que são Pix, TED ou DOC para ou de uma pessoa. Ao cruzar ou acumular essas linhas, o nome não é gravado como associação, e a leitura ignora a associação que já existia para elas. É pessoa quando a descrição tem "transferência", "Pix", "TED" ou "DOC" e não traz CNPJ nem nome de empresa (Ltda, mercado, padaria, posto e parecidos). Pix para empresa continua lembrado.

Motivo: o motivo de uma transferência para pessoa muda a cada vez, então o nome não diz a sessão.

Verificação: `tsc` limpo e os testes de extratos passam, com casos novos para Pix com CPF mascarado, sem documento, com CNPJ e compra comum. Não verificado na tela. Pix sem documento e sem nome de empresa conta como pessoa, então um Pix genérico para um comércio de nome incomum também deixa de ser lembrado; a sessão se escolhe à mão. Vale em produção depois do deploy do `backend`.

Arquivos:

- `apps/backend/src/extratos/dominio/nome-extrato.ts`
- `apps/backend/src/extratos/dominio/nome-extrato.spec.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`

## Ignorar linhas do extrato

O que foi feito: na Conferência do web, a pessoa seleciona linhas e usa "Ignorar N". A linha ignorada não é apagada: ela sai da conferência, da contagem de pendentes (o mês pode ficar conferido sem ela), do resumo de entradas e saídas e do que o assistente enxerga como pendente. Fica na aba "Ignoradas", com o número ao lado, onde "Reativar" (na linha ou em lote) a devolve. Linha ignorada não pode ser lançada nem cruzada até ser reativada, e linha já cruzada não pode ser ignorada. O mobile esconde as ignoradas da lista.

Motivo: há linhas do extrato sem importância para a gestão das finanças, e a pessoa quer tirá-las do caminho sem perder o registro.

Verificação: `tsc` limpo no backend, frontend e mobile; 380 testes do backend passam, com casos novos (linha ignorada recusa o lançamento, ignorar e reativar chegam ao repositório) e o catálogo de eventos do outbox com `ignorar-linhas` e `reativar-linhas`. A migração `20261103180000_linhas_ignoradas` foi aplicada no Postgres local e a coluna `ignored_at` existe. Não verificado: a tela no navegador e o Docker, que não foi reconstruído. Reprocessar o extrato recria as linhas e perde a marca de ignorada. O `backend` aplica a migração sozinho ao subir.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261103180000_linhas_ignoradas/migration.sql`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.lote.spec.ts`
- `apps/backend/src/extratos/extratos.controller.ts`
- `packages/contracts/src/index.ts`
- `apps/frontend/app/api/extratos/ignorar/route.ts`
- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/mobile/src/paginas/extratos/Conferencia.tsx`

## Dividir linha, nomes lembrados e calculadora

O que foi feito:

- Dividir: na Conferência, cada linha sem lançamento tem "Dividir". O modal aceita de 2 a 10 partes, cada uma com valor, sessão e nome. O valor aceita uma conta (`120,50 / 2`), tem "+ restante" e o valor guardado na calculadora, e o modal mostra a soma e quanto falta. O backend confere que as partes somam a linha, no mesmo sentido, cria um lançamento único e pago por parte e liga a linha a todas (`statement_line_parts`; a linha aponta para a primeira). Se uma parte falha, as criadas são apagadas. Desfazer a linha dividida apaga os lançamentos das partes.
- Nomes: a linha tem um campo de nome. O nome diferente da descrição do extrato fica guardado (`statement_names`, por descrição normalizada, com o número de usos e o último uso). Da próxima vez, a linha com a mesma descrição já vem com o último nome e mostra os outros, mais a descrição original, para escolher ou digitar outro. Vale para acumular, para o lote e para as partes da divisão.
- Calculadora: ícone fixo no canto de baixo da tela, em todas as telas, que abre a janela flutuante e some enquanto ela está aberta nesse canto. Modo básico (números, as quatro operações, %, ±, apagar) e avançado (parênteses, x², potência, raiz, 1/x, ÷2, ÷3, memória e histórico). Fixada, continua aberta ao trocar de tela; o botão de canto muda a posição e o de minimizar deixa só o visor. "Guardar para usar" passa o resultado aos campos de valor da divisão, e o modal de dividir tem a calculadora embutida, porque a janela flutuante fica por baixo do modal. A conta é avaliada sem `eval`, e nada fica no navegador nem no servidor.
- O campo de sessão abre a lista dentro do modal quando está num modal.
- O backup dos dados passou a levar as partes, os nomes e o `ignoredAt` das linhas ignoradas, que antes se perdia numa restauração. Zerar os dados apaga as tabelas novas.

Motivo: um valor do extrato às vezes junta mais de um gasto, a mesma descrição merece nomes diferentes conforme o caso, e as contas da divisão pediam uma calculadora à mão.

Verificação: `tsc` limpo em backend, frontend e mobile; lint limpo nos arquivos novos; backend com os testes de extratos passando, incluindo a divisão (soma, sentido, falha no meio e desfazer) e os nomes; o avaliador da calculadora conferido em 21 contas. Na tela, no Docker local, em 1280 px claro e 375 px escuro: a conta `200 + 10%` dá 220, a calculadora fixa, minimiza e não cria rolagem horizontal, a divisão de R$ 1.500,00 em 500 + 1.000 grava "Dividida em 2", desfazer volta a linha, e o nome dado passa a ser oferecido. A migração `20261104120000_partes_e_nomes_do_extrato` foi aplicada no Postgres local. Não verificado: o mobile, que não tem a divisão, os nomes nem a calculadora.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261104120000_partes_e_nomes_do_extrato/migration.sql`
- `apps/backend/src/extratos/dominio/divisao.ts`
- `apps/backend/src/extratos/dominio/divisao.spec.ts`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.lote.spec.ts`
- `apps/backend/src/extratos/extratos.controller.ts`
- `apps/backend/src/dados/dominio/pacote.ts`
- `apps/backend/src/dados/dominio/zerar.ts`
- `apps/backend/src/dados/adaptadores/prisma-dados-repositorio.ts`
- `packages/contracts/src/index.ts`
- `apps/frontend/app/api/extratos/dividir/route.ts`
- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/frontend/app/extratos/conferencia/divisao.tsx`
- `apps/frontend/app/extratos/conferencia/busca-sessao.tsx`
- `apps/frontend/components/calculadora/expressao.ts`
- `apps/frontend/components/calculadora/calculadora.tsx`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/components/ui/icone.tsx`

## Divisão com sessão fixa e desfazer completo

O que foi feito:

- Dividir com uma parte numa sessão Fixo que já tem a transação dava erro 500. Agora essa parte paga a transação da fixa com o valor da parte, em vez de criar outra, e mantém o nome dela. O modal avisa isso na parte e oferece "Usar R$ X" com o valor da fixa. Se a fixa já foi paga no mês, a divisão é recusada com uma mensagem, sem criar nada; duas partes na mesma fixa também são recusadas.
- A recusa vinda das finanças (como "Esta sessão fixa já foi lançada.") passou a voltar como 400 com a mensagem, e não como 500.
- Desfazer deixa a linha como se nunca tivesse sido lançada: o lançamento que nasceu dela (acúmulo ou parte da divisão) é apagado, junto com o nome lembrado que ele deixou (um uso a menos) e a associação da descrição que apontava para ele. O lançamento que já existia (cruzamento ou fixa paga por uma parte) volta a pendente. Antes, desfazer um acúmulo deixava o lançamento pendente na sessão.
- A linha e cada parte guardam se o lançamento nasceu delas (`entry_created` e `created`). A migração marca as linhas já lançadas por acúmulo.
- O lançamento que nasceu do extrato (justificativa "Lançamento do extrato.") e fica sem nenhuma linha ao desfazer também é apagado, mesmo quando a linha desfeita só o pagou. Assim a sessão Fixo deixa de aparecer como "Fixo já lançado".
- A migração `20261104170000_apaga_lancamentos_soltos_do_extrato` apaga o que os desfazer antigos deixaram: lançamento do extrato pendente, sem linha, sem parte e sem ocorrência paga. Grava `excluir-lancamento` no outbox para cada um. No banco local foram dois.
- Reabrir pelo extrato acha a ocorrência paga na data mesmo quando o valor pago foi o do lançamento, escolhido no cruzamento.
- A parte de uma linha dividida passou a ocupar a vaga do mês do lançamento que ela pagou.

Motivo: a divisão de um valor que junta a fixa e outra entrada falhava, e desfazer precisa voltar tudo ao que era antes.

Verificação: `tsc` limpo em backend e frontend, lint limpo na Conferência, 399 testes do backend passando, com os casos novos (parte na fixa, fixa já paga, falha depois de pagar a fixa, desfazer misto, desfazer acúmulo e desfazer cruzamento). No Docker local, em 1280 px: R$ 4.500,00 dividido em R$ 3.000,00 numa fixa pendente e R$ 1.500,00 em outra sessão grava "Dividida em 2"; desfazer volta a fixa a pendente e apaga a outra parte; acumular e desfazer apaga o lançamento criado; no banco não sobrou lançamento, parte nem associação. A migração `20261104150000_lancamento_criado_pela_linha` foi aplicada no Postgres local.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261104150000_lancamento_criado_pela_linha/migration.sql`
- `apps/backend/prisma/migrations/20261104170000_apaga_lancamentos_soltos_do_extrato/migration.sql`
- `apps/backend/src/extratos/dominio/divisao.ts`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.lote.spec.ts`
- `apps/backend/src/extratos/extratos.controller.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/dados/dominio/pacote.ts`
- `packages/contracts/src/index.ts`
- `apps/frontend/app/extratos/conferencia/divisao.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`

## Apagar leva em conta o estado do resto

- Apagar um lançamento, uma sessão, um grupo ou um extrato passou a desfazer antes o que as linhas do extrato fizeram, em vez de recusar ou de deixar sobra. É o mesmo desfazer da Conferência, feito pelo outro lado: o lançamento que nasceu da linha some, o que a linha pagou volta a pendente, e o nome lembrado e a associação da descrição são esquecidos. A linha volta para a Conferência.
- Excluir a sessão solta as linhas ligadas aos lançamentos dela, esquece as associações de descrição que apontavam para ela e só então a encerra. Excluir o grupo faz o mesmo para todas as sessões dele.
- Excluir ou reprocessar um extrato com linhas cruzadas deixou de ser recusado ("Desfaça os cruzamentos na Conferência antes"): cada linha é desfeita antes de o extrato sair.
- Apagar um lançamento sincronizado com o extrato deixou de ser recusado. A tela avisa "A linha do extrato volta para a Conferência" na confirmação. Apagar uma ocorrência de uma série continua recusando o que já foi pago; só quando é a última e o lançamento inteiro sai as linhas são soltas.
- A linha dividida volta inteira quando uma das partes é apagada: as partes criadas somem e a fixa que uma parte pagou volta a pendente.
- O compromisso da agenda ligado ao lançamento apagado volta a pendente, porque estava concluído por causa do pagamento.
- Sessão ou grupo que guarda uma meta não é apagado: a resposta manda excluir a meta em Metas, porque a meta ficaria sem onde guardar o valor.
- O que cruza fatias (finanças, grupos, extratos e metas) mora em `apps/backend/src/exclusoes`, com as mesmas rotas de antes (`DELETE /lancamentos/:id`, `/lancamentos/:id/ocorrencias/:numero`, `/sessoes/:id` e `/grupos/:id`). Os controladores de finanças e de grupos perderam essas rotas.

Motivo: apagar uma coisa que o extrato tinha lançado deixava a linha cruzada com algo que não existia mais, ou o pagamento sem origem. O estado do resto do sistema precisa voltar ao que era.

Verificação: `tsc` limpo em backend e frontend, lint limpo, 419 testes do backend passando, com os casos novos de liberar linhas e do orquestrador. No Docker local, com um extrato de duas linhas acumuladas em sessões novas: excluir a sessão devolveu a linha à Conferência e apagou o lançamento criado; excluir o grupo devolveu a outra; excluir um lançamento sincronizado (antes 409) devolveu a linha; excluir o extrato com linha cruzada (antes 409) apagou o lançamento criado. No banco não sobrou lançamento, nome lembrado nem grupo de teste. Não verificado: apagar uma parte de linha dividida pela tela, e o compromisso da agenda voltando a pendente (coberto só pelo código).

Arquivos:

- `apps/backend/src/exclusoes/` (novo: serviço, controlador, módulo e teste)
- `apps/backend/src/persistencia/desligar-compromissos.ts` (novo)
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.lote.spec.ts`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/financas/dominio/vista.ts`
- `apps/backend/src/financas/dominio/vista.spec.ts`
- `apps/backend/src/financas/financas.controller.ts`
- `apps/backend/src/grupos/grupos.controller.ts`
- `apps/backend/src/grupos/adaptadores/prisma-grupos-repositorio.ts`
- `apps/backend/src/metas/aplicacao/metas.service.ts`
- `apps/backend/src/app.module.ts`
- `apps/frontend/app/financas/acoes.tsx`, `page.tsx` e `tabela.tsx`
- `apps/frontend/app/grupos/page.tsx`

## Revisão do modelo: transações, compromissos e contas

- **Bug corrigido:** a descrição da ferramenta `criar_compromisso` dizia ao assistente o contrário do que o backend faz (`fixed` = uma vez, `periodical` = todo mês, `time` = todo mês até uma data). O assistente criava a categoria errada.
- **Um vocabulário só:** o relatório "por tipo" passou a usar o nome da categoria do formulário (Única, Extra, Recorrente, Parcela, Empréstimo) em vez de adicional/fixo/variável. A categoria "Fixa" do lançamento virou "Recorrente" na tela, para não colidir com a sessão "Fixo". Os compromissos chamam-se "Uma vez", "Todo mês", "Todo mês até uma data", "Toda semana" e "Todo ano".
- **Formulário menor:** o campo "Tipo: Compromisso/Incomum" saiu da tela (é derivado: fixa, parcela e empréstimo são compromisso; ligar à agenda também marca). "Prioridade" saiu da tela e da Base (era gravada e não produzia efeito; o backend aceita sem ela). "Justificativa" ficou opcional de verdade: o backend não exige mais, e o assistente deixa vazio em vez de gravar "Registrado pelo assistente.". A regra de dia útil ficou em "Mais opções", fechada; o padrão da conta vale sem abrir.
- **A fixa atravessa o ano:** a recorrente gera ocorrências do ano de início até o ano seguinte ao atual (`horizonteDaFixa`), e a grade gravada ganha na leitura as ocorrências novas (`estenderGrade`) sem mexer no que já está gravado. O diálogo de virada virou uma revisão: "Tudo continua como está", com "Manter o que está marcado" e "Depois".
- **Agenda:** compromisso "Toda semana" (todos os dias do mês com o mesmo dia da semana, a partir do início) e "Todo ano" (a mesma data; 29 de fevereiro cai no 28). Nenhum dos dois tem data de fim.
- **Contas e saldo:** a conta (que o extrato já criava pelo nome) ganhou tipo (conta ou cartão de crédito) e saldo inicial. O lançamento pode apontar para a conta de onde sai ou em que entra, e pode ser marcado como transferência entre contas próprias: muda o saldo das contas e não entra na sobra (como "já incluso em outro"). A Base mostra a etiqueta "Transferência". Finanças ganhou o bloco Contas, com "Saldo hoje" e "Fim do mês" (no cartão, "Lançado na fatura" e "Fatura prevista"), e o diálogo de criar e editar conta; o cálculo é `resumoDaConta` em contracts. O lançamento que nasce de uma linha do extrato já nasce na conta do extrato, e a migração `20261104211000_conta_dos_lancamentos_do_extrato` liga os antigos. A exportação e importação do pacote levam a conta e a transferência. O assistente conhece `accountId` e `transfer` na criação de lançamento, e o prompt explica.
- Slice nova `apps/backend/src/contas` (listar, criar, atualizar; eventos `criar-conta` e `atualizar-conta`) e rotas `/api/contas` no BFF.

Motivo: o lançamento e o compromisso são o centro; os campos que não produziam efeito confundiam, a fixa parava em dezembro, a agenda não repetia por semana nem por ano, e uma pessoa comum precisa ver o saldo da conta e a fatura do cartão, não só a sobra.

Verificação: `tsc` limpo em backend, frontend, agents e mobile; lint limpo; 434 testes no backend (novos: transferência fora da sobra, fixa em janeiro, semanal, anual, saldo da conta, serviço de contas) e 57 no agents. As migrações `20261104210000_contas_com_saldo_e_transferencia` e `20261104211000_conta_dos_lancamentos_do_extrato` foram aplicadas no Postgres local e o diff contra o schema está vazio. Pela API local: conta criada e nome repetido recusado; lançamento sem justificativa, tipo e prioridade aceito; transferência guardada e fora da sobra; recorrente criada em 2026 aparece em março de 2027; compromisso semanal aparece 5 vezes no mês. No navegador, em 1280 e 375 px, o bloco Contas aparece sem rolagem horizontal. Não verificado: a tela de agenda criando semanal e anual pelo formulário (só pela API), e o assistente usando conta e transferência com o modelo real.

Não feito, de propósito: a limpeza interna dos campos redundantes do lançamento (`dueDate`, `nextDueDate`, `adjustments`, as quatro datas) e a unificação dos dois vínculos do compromisso com o dinheiro (`entryId` e `sessionId`): mudam o banco sem mudar nada para quem usa e ficam para outra branch.

Arquivos:

- `apps/backend/prisma/schema.prisma` e as duas migrações novas
- `packages/contracts/src/index.ts`
- `apps/backend/src/contas/` (novo) e `app.module.ts`
- `apps/backend/src/financas/` (controlador, serviço, porta, adaptador, `vista.ts`, `pedido.ts`, specs)
- `apps/backend/src/agenda/aplicacao/ocorrencias.ts` e spec, `adaptadores/prisma-agenda-repositorio.ts`
- `apps/backend/src/extratos/` (serviço, porta, adaptador)
- `apps/backend/src/dados/` (pacote e adaptador)
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts` e spec
- `apps/agents/src/assistente/dominio/prompts.ts` e `consultor.ts`
- `apps/frontend/app/financas/` (`contas.tsx` novo, `page.tsx`, `tabela.tsx`, `rotulos.ts`, `virada.tsx`)
- `apps/frontend/app/agenda/itens.ts` e `page.tsx`
- `apps/frontend/app/relatorios/page.tsx`
- `apps/frontend/app/api/contas/` (novo)
