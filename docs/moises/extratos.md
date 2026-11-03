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
