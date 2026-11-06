# Hoje

Registro da branch `moises/hoje`.

## A aba Hoje: o checklist do dia

O que foi feito: uma aba nova, "Hoje", entre Assistente e Agenda, com o dia da pessoa numa lista só.

- **Tarefas suas.** Um campo no topo anota a tarefa para o dia aberto; Enter ou o botão adiciona. A tarefa não feita segue para os dias seguintes com o chip "Ficou de <dia>". Marcar conclui no dia de hoje; desmarcar reabre; o x apaga. As feitas descem para a seção "Feito", riscadas.
- **O que entra sozinho.** Os compromissos do dia (marcar dá como cumprido na Agenda), os pagamentos do dia (vencimento no dia, ou pago nesse dia): marcar uma parcela ou um empréstimo registra um pagamento na data pelo valor previsto, e desmarcar desfaz esse pagamento; na única e na recorrente a ocorrência muda de status. Quando o dia é hoje, as pendências do sistema entram em "Para fazer" com seta para a tela certa: vencimentos atrasados, extrato do mês com linhas sem lançamento, sobra do mês sem separar para as metas.
- **Navegação.** Setas para o dia anterior e o seguinte, e "Hoje" para voltar. A barra do topo mostra quantas das coisas marcáveis já foram feitas.
- **Backend.** Slice `apps/backend/src/hoje`: tabela `tasks` (migração `20261106100000_tarefas_do_dia`), porta e adaptador Prisma das tarefas com os eventos `criar-tarefa`, `atualizar-tarefa`, `concluir-tarefa` e `excluir-tarefa` no outbox, e `HojeService.dia` que monta o dia a partir das tarefas, da agenda, das finanças (ocorrências pelo mês contábil), da conferência e das metas. Rotas: `GET hoje?date=`, `POST tarefas`, `PATCH tarefas/:id`, `PATCH tarefas/:id/concluir`, `DELETE tarefas/:id`.
- **Assistente.** `consultar_hoje`, `criar_tarefa`, `concluir_tarefa` e `excluir_tarefa`, e o prompt explica a aba.
- **Mobile.** Ainda não tem a aba; usa o mesmo endpoint quando entrar.

Motivo: a pessoa quer abrir uma tela só de manhã e ver o que tem para fazer, sem procurar em quatro abas.

Verificação: 468 testes no backend (4 novos do serviço do dia: tarefas com as que ficaram de antes, compromissos e vencimentos do dia, pendências só em hoje, concluir e reabrir), 60 no agents; tsc e lint limpos; a migração aplicada no Postgres local e o diff contra o schema vazio. No navegador, em 1280 px claro e 375 px escuro: o item Hoje no menu, a tarefa anotada pela tela, o chip da tarefa que ficou de ontem, marcar o compromisso (cumprido na Agenda) e a parcela (pagamento registrado na data nas Finanças), a barra de andamento e a pendência de atraso com seta, sem rolagem horizontal. Dados de teste apagados. Não verificado: o assistente com as ferramentas novas no modelo real; o mobile não tem a aba.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma` e `migrations/20261106100000_tarefas_do_dia/`
- `apps/backend/src/hoje/` (novo) e `app.module.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/hoje/page.tsx` (novo), `app/api/hoje/` e `app/api/tarefas/` (novos)
- `apps/frontend/components/ui/app-shell.tsx` e `icone.tsx`

## Ajustes: lista, edição, canto de cima e calculadora

O que foi feito:

- **Hoje como lista.** Um quadro só, com o campo de anotar na primeira linha e os grupos como cabeçalhos dentro dele (Atrasados, Compromissos, Pagamentos de hoje, Para fazer, Feito). As linhas ficaram mais curtas e a tarefa ganhou o lápis: o texto e o dia editam no lugar, Enter salva e Escape cancela (`PATCH tarefas/:id`).
- **Atrasados marcáveis.** Os vencimentos que ficaram para trás entram na lista de hoje no grupo "Atrasados", com "Venceu em <dia>", em vez de uma pendência com seta. Marcar paga na data de hoje: parcela e empréstimo registram o pagamento; única e recorrente mudam a ocorrência para paga com `paidOn` de hoje (o `PATCH ocorrencias/:numero` passou a aceitar `paidOn`). A pendência "atrasado" saiu do contrato.
- **Canto de cima à direita.** Tema (claro e escuro, gravado nas configurações), sino de notificações e o avatar da conta saíram do menu lateral e foram para uma barra acima do conteúdo. O avatar abre um menu com nome, e-mail, Perfil e Sair. O menu lateral ficou só com a navegação, e o botão de recolher virou só o ícone, ao lado da logo.
- **Calculadora arrastável.** O botão flutuante arrasta para qualquer ponto da tela, sem sair dela, e a posição fica no navegador (`prumo-calculadora-posicao`). O clique que fecha um arrasto não abre a calculadora.

Motivo: a pessoa marca o que já fez e espera ver pago nas Finanças; queria a tela parecendo uma lista, a tarefa editável, os controles da conta no canto de cima e a calculadora onde preferir.

Verificação: 468 testes no backend (o serviço do dia com os atrasados na lista), tsc e lint limpos; no navegador, em 1280 claro e 375 escuro: a barra do canto com tema, sino e conta; o recolher só com ícone e sem "Sair" no menu lateral; o atrasado marcado ficou pago hoje nas Finanças; a tarefa editada pelo lápis; o menu da conta com Perfil e Sair; a calculadora arrastada 300 px e no mesmo lugar depois de recarregar; sem rolagem horizontal. Dados de teste apagados.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/hoje/aplicacao/hoje.service.ts` e spec
- `apps/backend/src/financas/financas.controller.ts`, `aplicacao/financas.service.ts`, `portas/financas-repositorio.ts`, `adaptadores/prisma-financas-repositorio.ts`
- `apps/frontend/app/hoje/page.tsx`
- `apps/frontend/components/ui/app-shell.tsx`, `icone.tsx`, `botao-do-tema.tsx` (novo)
- `apps/frontend/components/auth/conta-do-menu.tsx`
- `apps/frontend/components/calculadora/calculadora.tsx` e `posicao.ts` (novo)

## Desfazer toda a conferência (Configurações)

O que foi feito: em Configurações, Dados e privacidade, entrou "Desfazer a conferência dos extratos", com confirmação pela palavra DESFAZER. O backend (`ExtratosService.desfazerConferencia`, rota `POST extratos/conferencia/desfazer-tudo`) passa por todas as linhas cruzadas ou divididas com o mesmo desfazer da Conferência (o lançamento que nasceu da linha some, o que ela pagou volta a pendente, a divisão se desfaz), reativa as linhas ignoradas e esquece os nomes lembrados e as associações de descrição. Os extratos e as linhas ficam, como no dia da importação. A resposta diz quantas linhas, reativadas e nomes. Evento `desfazer-conferencia` no outbox, além dos eventos de cada linha.

Motivo: a pessoa quer recomeçar a conferência do zero sem reimportar os extratos.

Verificação: 469 testes no backend (novo: desfazer tudo volta cada linha, reativa as ignoradas, esquece os nomes e apaga os órfãos sem apagar os extratos); tsc e lint limpos. De ponta a ponta sobre uma cópia do banco local (salvo com pg_dump antes e restaurado depois): pela tela, com a palavra DESFAZER, 284 linhas cruzadas e 4 partes voltaram a pendentes, 33 ignoradas reativadas, 35 nomes e 58 associações esquecidos, 298 lançamentos do extrato apagados (inclusive 12 que já estavam sem linha), os 6 extratos ficaram, e a Conferência de outubro passou a mostrar 207 de 207 sem lançamento e sem proposta pelo nome. O banco local voltou exatamente ao que era.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`, `extratos.controller.ts`, `portas/extratos-repositorio.ts`, `adaptadores/prisma-extratos-repositorio.ts`, `extratos.service.lote.spec.ts`
- `apps/frontend/app/configuracoes/painel.tsx` e `app/api/extratos/conferencia/desfazer-tudo/route.ts` (novo)

## Mobile web: gaveta no lugar da faixa e a Geral por mês

O que foi feito:

- **Gaveta.** No celular, a faixa horizontal de abas saiu. A barra de cima tem o ícone do menu à esquerda, a logo e, à direita, tema, avisos e conta. O ícone abre uma gaveta pela esquerda com a mesma lista de abas do menu lateral; ela fecha ao escolher uma aba, ao tocar fora ou no Escape. No tablet e no desktop o menu lateral recolhível continua igual, e a lista de abas é um componente só (`ListaDoMenu`).
- **Finanças no celular.** Só a Base: o seletor Base/Geral some e a Geral (a tabela de meses) fica para o tablet em diante (`useCelular`, em `components/ui/tela.ts`). A versão da Geral por mês para o celular foi feita e depois retirada, a pedido.
- **Mês como filtro.** Na Base, a faixa de meses lado a lado virou um seletor "Mês", ao lado do ano, do grupo e da categoria, no celular e no desktop.
- Ícones novos: menu e fechar.

Motivo: a faixa de abas e a Geral mês a mês ficavam feias e longas no celular; o pedido foi um menu lateral que abre pelo ícone.

Verificação: tsc e lint limpos. No navegador, em 375 px: a faixa de abas sumiu e a barra de cima tem o ícone do menu; a gaveta abre com as treze abas e fecha ao navegar; em Finanças o seletor Base/Geral some, só a Base aparece, o mês é um seletor (trocar para outubro muda o título e a lista) e a tela tem 958 px de altura, sem rolagem horizontal. Em 1280 px: o menu lateral, o seletor Base/Geral e a tabela da Geral continuam, e a Base também usa o seletor de mês.

Arquivos:

- `apps/frontend/components/ui/app-shell.tsx` e `icone.tsx`
- `apps/frontend/app/financas/visao-geral.tsx`, `tabela.tsx` e `page.tsx`
- `apps/frontend/components/ui/tela.ts` (novo)

## Subatividades

O que foi feito: uma atividade da aba Hoje pode ter subatividades, um nível só. A tarefa ganhou `parentId` (migração `20261106150000_subtarefas`, com apagar em cascata). Na tela, o "+" na linha da atividade abre o campo da subatividade logo abaixo; as filhas aparecem recuadas e a atividade mostra "1 de 3". Marcar a atividade marca as subatividades abertas; reabrir a atividade reabre só ela; marcar a última subatividade fecha a atividade, e reabrir uma delas reabre a atividade (`hoje/dominio/subtarefas.ts`). A lista do dia traz as subatividades junto com a atividade, mesmo quando a data delas é outra. O assistente já tinha as quatro ferramentas de tarefa (consultar o dia, anotar, concluir e apagar), porque o `agents` carrega o catálogo inteiro do contrato; `criar_tarefa` ganhou `parentId` para anotar uma subatividade.

Motivo: na lista, uma atividade grande se divide em passos.

Verificação: 472 testes no backend (3 novos do domínio das subatividades), tsc e lint limpos; a migração aplicada no Postgres local. No navegador, em 1280 e 375 px: o "+" abre o campo e o foco fica nele enquanto se digita; duas subatividades criadas pela tela; marcar uma deixa a atividade em "1 de 2"; marcar a segunda fecha a atividade, que vai para Feito; reabrir uma subatividade reabre a atividade; apagar a atividade apaga as filhas; sem rolagem horizontal, inclusive com o campo da subatividade aberto.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma` e `migrations/20261106150000_subtarefas/`
- `apps/backend/src/hoje/dominio/subtarefas.ts` e spec (novos), `portas/tarefas-repositorio.ts`, `adaptadores/prisma-tarefas-repositorio.ts`, `aplicacao/hoje.service.ts` e spec, `hoje.controller.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/frontend/app/hoje/page.tsx`

## Aba Contas

O que foi feito: as contas saíram do bloco solto em Finanças e ganharam a aba "Contas", entre Finanças e Metas. À esquerda, a lista de contas e cartões com o saldo de hoje (ou o lançado na fatura); à direita, a conta escolhida: tipo, saldo inicial, saldo hoje e fim do mês, os movimentos do mês (pela data em que contam, com o saldo correndo linha a linha e "Previsto" nos pendentes), o início e o fim do mês, e os extratos importados nela com o estado de cada um. Criar e editar usam o mesmo diálogo (`app/contas/dialogo.tsx`). Excluir conta é novo: `DELETE contas/:id` apaga a conta, os lançamentos dela ficam sem conta, e a conta com extratos importados é recusada até os extratos saírem; evento `remover-conta` no outbox. O formulário de lançamento continua escolhendo a conta.

Motivo: as contas estavam soltas dentro de Finanças, sem lugar para ver os movimentos de cada uma.

Verificação: tsc e lint limpos no backend e no frontend; 64 testes de contas e assistente passando. No navegador, em 1280 e 375 px: o item Contas no menu, a lista com a conta escolhida em destaque, o detalhe com saldo inicial, saldo hoje, fim do mês, o mês com início e fim, os seis extratos do Nubank com o estado; uma conta de teste criada pela API, editada pelo diálogo e excluída pela tela com confirmação; o Excluir fica desabilitado na conta com extratos; sem rolagem horizontal. Não verificado: a lista de movimentos com dados, porque o banco local está sem lançamentos ligados a conta depois do desfazer da conferência feito na simulação.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/contas/contas.controller.ts`, `aplicacao/contas.service.ts`, `portas/contas-repositorio.ts`, `adaptadores/prisma-contas-repositorio.ts`
- `apps/frontend/app/contas/page.tsx` e `dialogo.tsx` (novos), `app/api/contas/[id]/route.ts`
- `apps/frontend/app/financas/page.tsx` (o bloco saiu) e `app/financas/contas.tsx` (apagado)
- `apps/frontend/components/ui/app-shell.tsx` e `icone.tsx`

## Árvore de tarefas, arraste e menu da linha

O que foi feito: a subatividade pode ter subatividades, sem limite de nível. A linha da tarefa ganhou um punho à esquerda: segurar e arrastar reordena entre as irmãs (um traço azul mostra onde vai cair) e soltar mais à direita, abaixo de uma linha, põe a tarefa dentro dela; dá para tirar uma subatividade para a raiz e aninhar em cadeia. Os botões de editar, apagar e "+" viraram um menu de três pontos verticais com Subatividade, Editar, Subir, Descer, Tirar de dentro (quando há pai) e Apagar. No backend, `PATCH tarefas/:id/mover` recebe `parentId` (null para a raiz) e `beforeId` (a irmã na frente da qual entra; sem ela, fica no fim), recusa ciclo e renumera as irmãs; evento `mover-tarefa` no outbox. Marcar e reabrir seguem a árvore inteira (`hoje/dominio/subtarefas.ts`). O assistente ganhou `mover_tarefa`.

Motivo: organizar a lista como no Notion, arrastando, em vez de só criar e apagar.

Verificação: tsc e lint limpos no backend e no frontend; os testes do domínio e do serviço de Hoje e do assistente passando. No navegador, em 1280 e 375 px, com três tarefas criadas pela API: o menu abre com as opções certas para cada linha (Subir só quando não é a primeira, Tirar de dentro só na subatividade) e fecha ao clicar fora; Subatividade abre o campo com o foco; arrastar uma tarefa para dentro da subatividade a deixa no terceiro nível, com o traço do destino recuado; Tirar de dentro sobe um nível, depois do pai; arrastar antes de outra troca a ordem na tela e no banco; Subir troca a posição com a irmã; Editar abre o formulário no lugar e Escape fecha; Apagar remove; sem rolagem horizontal.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/hoje/dominio/subtarefas.ts` e spec, `portas/tarefas-repositorio.ts`, `adaptadores/prisma-tarefas-repositorio.ts`, `aplicacao/hoje.service.ts`, `hoje.controller.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/frontend/app/api/tarefas/[id]/mover/route.ts` (novo)
- `apps/frontend/app/hoje/page.tsx` e `menu-da-linha.tsx` (novo)
- `apps/frontend/components/ui/icone.tsx`

## Livre do mês, limite por sessão e tarefa recorrente

O que foi feito: a Hoje ganhou o cartão "Livre até o fim do mês": a sobra do mês com o que ainda vai vencer, mais o que veio dos meses anteriores, menos o que as metas já separaram, dividido pelos dias que faltam (`HojeResposta.livre`, pelo mesmo cálculo das metas). A sessão de acúmulo ganhou um limite de saídas por mês (`Session.limitCents`, migração `20261106170000_limite_da_sessao`): o campo fica no diálogo da sessão em Grupos, a Base mostra "usado de limite" com uma barra na linha da sessão (`BaseResposta.limits`), a Hoje lista as sessões com limite no cartão e põe a que estourou nas pendências, e a varredura de avisos manda a notificação do tipo novo "Limites" aos 80% e ao passar (`usoDosLimites` no contrato, `avisosDeLimite` no domínio dos avisos; uma vez por sessão, mês e marca). A tarefa da raiz pode repetir (`Task.repeat`, migração `20261106173000_tarefa_recorrente`): todo dia, dias úteis, toda semana ou todo mês, escolhido em Editar; ao ser marcada, nasce de novo no próximo dia da regra que ainda não passou, com as subatividades abertas (`hoje/dominio/repeticao.ts`). As ferramentas `criar_sessao`, `editar_sessao` e `criar_tarefa` ganharam `limitCents` e `repeat`.

Motivo: o sistema registrava, mas não orientava quanto dá para gastar nem avisava antes de uma sessão estourar; e a tarefa de toda semana precisava ser anotada de novo a cada vez.

Verificação: 478 testes no backend (repetição, sobra livre e limites na Hoje, avisos de limite), 60 no agents, tsc e lint limpos nos três; as duas migrações aplicadas pelo backend ao subir. No navegador, em 1280 e 375 px, com um grupo, uma sessão com limite de R$ 100 e um lançamento de R$ 90 criados pela API: a Hoje mostra o cartão "Livre até o fim do mês" com os dias que faltam e a barra "Lanches R$ 90,00 de R$ 100,00" (90%); a Base mostra o mesmo uso na linha da sessão; Grupos mostra "Limite de R$ 100,00 por mês" e o diálogo abre com o campo preenchido; a tarefa editada para "Toda semana" ganha o chip e, ao ser marcada, nasce de novo em 13 de novembro com a mesma regra; sem rolagem horizontal. Os 5 E2E passaram de novo na build nova. Não verificado: a notificação de limite pela varredura (ela corre no horário do BullMQ) e o estouro acima de 100% na tela.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`, `migrations/20261106170000_limite_da_sessao/`, `migrations/20261106173000_tarefa_recorrente/`
- `apps/backend/src/hoje/dominio/repeticao.ts` e spec (novos), `adaptadores/prisma-tarefas-repositorio.ts`, `aplicacao/hoje.service.ts` e spec, `hoje.controller.ts`, `hoje.module.ts`
- `apps/backend/src/grupos/portas/grupos-repositorio.ts`, `adaptadores/prisma-grupos-repositorio.ts`, `grupos.controller.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`, `financas.module.ts`
- `apps/backend/src/notificacoes/dominio/avisos.ts` e spec, `aplicacao/varredura.service.ts`, `notificacoes.module.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/frontend/app/hoje/page.tsx`, `app/grupos/page.tsx`, `app/financas/tabela.tsx`, `app/financas/page.tsx`

## Hoje e Contas no mobile

O que foi feito: o app mobile ganhou a página Hoje (`/inicio/hoje`, ligada pelo bloco "Hoje" do Início, que agora vem de `GET /api/hoje` com "x de y" e um link "Ver o dia"): navegação de dia, andamento, campo de anotar, os grupos do dia com a caixa de marcar (tarefa, compromisso e vencimento, com as mesmas chamadas do web), subatividades recuadas por nível, apagar com confirmação e as pendências como links. E as páginas Contas (`/financas/contas`, ligada no topo de Finanças) e o detalhe da conta (`/financas/contas/:id`): saldo hoje, fim do mês, saldo inicial, movimentos do mês com saldo corrido e os extratos da conta. Só leitura. A barra de abas não mudou.

Motivo: a Hoje é a tela de uso diário e não existia no celular; as contas também não.

Verificação: `pnpm --filter mobile build` (tsc e vite) e `pnpm --filter mobile test` (10 testes) passando. No navegador em 375 px, pelo Vite contra o BFF local: o bloco Hoje no Início, a página Hoje com anotar, marcar, desmarcar, trocar de dia e apagar; a lista de contas e o detalhe com os extratos; sem rolagem horizontal; alvos de toque de 44 px. Não verificado: compromisso e vencimento na Hoje do mobile (o dia não tinha nenhum), conta do tipo cartão, tema escuro e o aparelho real.

Arquivos:

- `apps/mobile/src/paginas/Hoje.tsx`, `paginas/hoje/dia.ts` e spec (novos)
- `apps/mobile/src/paginas/Contas.tsx`, `paginas/contas/DetalheDaConta.tsx`, `paginas/contas/movimentos.ts` e spec (novos)
- `apps/mobile/src/App.tsx`, `paginas/Inicio.tsx`, `paginas/Financas.tsx`, `tema/tema.css`

## E2E com Playwright

O que foi feito: os cinco fluxos principais do frontend ganharam testes de ponta a ponta com Playwright, em `apps/frontend/e2e/`: Hoje (anotar, marcar, apagar pelo menu), Finanças (lançar uma única e ver na Base), Metas (criar e excluir), Agenda (criar um compromisso de hoje e apagar) e Importações (importar um CSV numa conta nova, ver as linhas e excluir). Os testes rodam em série contra o ambiente local já no ar (`pnpm --filter frontend e2e`), sem subir servidor, e apagam o que criaram mesmo em falha.

Motivo: as regras pedem E2E nos fluxos principais e só havia conferência manual.

Verificação: `pnpm --filter frontend e2e` com os 5 testes passando em 39 s contra o Docker local; nada sobrando na base depois. Nenhum defeito real encontrado.

Arquivos:

- `apps/frontend/playwright.config.ts`, `e2e/apoio.ts`, `e2e/*.spec.ts`, `e2e/fixtures/extrato.csv` (novos)
- `apps/frontend/package.json`, `pnpm-lock.yaml`, `.gitignore`
