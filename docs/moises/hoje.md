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
