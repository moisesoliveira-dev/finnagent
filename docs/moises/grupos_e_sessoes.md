# Grupos e sessões

## Aba Grupos

O que foi feito: aba Grupos em `/grupos`, no menu ao lado de Finanças. Dá para criar e remover grupos e sessões. Cada sessão pertence a um grupo. O valor da sessão e a soma do grupo aparecem com o componente Money, começando em zero, para a transação acumular ali depois. Os dados ficam no localStorage do navegador, chave `prumo-grupos`.

Motivo: a pessoa precisa de um lugar para criar os grupos e as sessões onde cada transação será acumulada.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/components/ui/list-row.tsx`

## Persistência no backend

O que foi feito: a aba Grupos deixou de gravar no navegador. O browser chama o Next em `/api/grupos` e `/api/sessoes`. O Next chama o Nest. O Nest grava grupos, sessões e o outbox no Postgres, filtrando por tenant. Sem `DIRECT_URL` (ou `DATABASE_URL`) o Nest responde 503 e a tela mostra essa mensagem.

Motivo: o pedido de funcionalidade inclui o backend no mesmo fluxo.

Arquivos:

- `apps/backend/src/grupos/`
- `apps/backend/src/app.module.ts`
- `apps/backend/package.json`
- `apps/frontend/app/api/grupos/`
- `apps/frontend/app/api/sessoes/`
- `apps/frontend/app/api/_lib/backend.ts`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/next.config.ts`
- `packages/contracts/src/index.ts`
- `pnpm-lock.yaml`

## Alinhamento às revisões

O que foi feito: a aba Grupos deixou o grid com valor arbitrário e passou a usar flex, com `min-w-0` nos blocos de texto. O backend passou a carregar o `.env` da raiz do monorepo, subindo pastas até achar `pnpm-workspace.yaml`. O acesso aos grupos ficou no Prisma 6 (schema e migration em `apps/backend/prisma`), atrás da porta `GruposRepositorio`; o comando não executa SQL. Remover um grupo grava um evento de outbox para cada sessão antes de apagá-la, e a foreign key é `RESTRICT`. O BullMQ publica o outbox na fila `outbox` quando `REDIS_URL` existe, e o consumidor grava o consumo de forma idempotente em `consumed_events`.

Motivo: alinhar a branch às revisões de interface, Docker e arquitetura.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/backend/src/grupos/`
- `apps/backend/prisma/`
- `apps/backend/Dockerfile`
- `apps/backend/package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`

## Assistente fora da aba Grupos

O que foi feito: o assistente saiu da aba Grupos. Nas outras abas ele continua.

Motivo: essa aba não registra gasto nem compromisso.

Arquivos:

- `apps/frontend/components/ui/app-shell.tsx`

## Formulário de criar sessão

O que foi feito: o formulário de criar sessão ficou visível na aba Grupos mesmo quando ainda não há grupo. Nome, grupo e o botão Criar sessão aparecem junto com a lista. Sem grupo, a tela pede para criar o grupo antes.

Motivo: a seção Sessões ficava só com o título, e é nessa aba que a sessão é criada.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`

## Sessão como custo

O que foi feito: a sessão passou a ser um custo com valor, positivo ou negativo. Na aba Grupos o formulário pede o valor em reais (menos para saída, como aluguel e conta de água; sem menos para entrada, como salário e hora extra) e mostra o valor com o componente Money. O Nest grava esse valor em centavos na sessão e no evento de outbox. Sem valor, a API responde 400.

Motivo: a sessão representa um custo do sistema, negativo ou positivo.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/backend/src/grupos/`

## Dependência `@next/env` no frontend

O que foi feito: `@next/env` entrou como dependência direta do frontend, na mesma versão do Next, para o `next build` achar o módulo.

Motivo: a imagem Docker falhava no typecheck com TS2307 em `next.config.ts`, que carrega o `.env` da raiz.

Arquivos:

- `apps/frontend/package.json`
- `pnpm-lock.yaml`

## Arranjo da tela de estrutura

O que foi feito: a aba Grupos passou a seguir o layout de `prumo-sessoes-grupos.html`, com os componentes e tokens já combinados. O título fica com os botões Novo grupo e Nova sessão. Cada grupo é um cartão com a descrição, a contagem e as sessões dentro. Sessão sem grupo aparece em Sem grupo. Criar e editar abrem diálogo, com nome e descrição de até 160 caracteres. O grupo da sessão é opcional. O Nest grava a descrição e aceita sessão sem grupo.

Motivo: a tela de estrutura precisava do arranjo da referência, sem sair do estilo do Prumo.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/components/ui/page-header.tsx`
- `apps/frontend/app/api/grupos/[id]/route.ts`
- `apps/frontend/app/api/sessoes/[id]/route.ts`
- `apps/backend/src/grupos/`
- `apps/backend/prisma/`
- `packages/contracts/src/index.ts`

## Ambiente local de simulação

O que foi feito: entrou o agente teste e a regra permanente do ambiente local de simulação. A pessoa usa o sistema em http://localhost:3000, com docker compose up na raiz. O agente confere o .env de desenvolvimento, sobe frontend, backend, agents e redis, e confirma que a tela abre. Sem DIRECT_URL ou DATABASE_URL ele para e diz o nome da variável. Não é produção.

Motivo: a simulação precisa acontecer no ambiente local da pessoa.

Arquivos:

- `.cursor/agents/teste.md`
- `.cursor/rules/teste.mdc`
- `.cursor/rules/docker.mdc`

## Postgres local na simulação

O que foi feito: a simulação local passou a usar um Postgres normal no Compose, serviço `postgres` (imagem `postgres:16-alpine`, volume `postgres_data`). O Compose define `DATABASE_URL` e `DIRECT_URL` do backend e a `DATABASE_URL` do agents para esse serviço. No Railway o banco continua no Supabase. O `.env.example` explica que, no local, o Compose entrega essas URLs. As regras e os agentes docker e teste, e a nota em hospedagem, foram alinhados a isso. Com o Postgres ligado, o publicador do outbox subia e derrubava a API porque o BullMQ, em ESM, não carrega o ioredis sozinho. O backend agora depende de `ioredis` e o publicador abre o cliente e o entrega à fila. Falha ao publicar fica no log e não derruba o HTTP. Em http://localhost:3000, GET `/api/grupos` respondeu 200. Um grupo e uma sessão foram gravados no Postgres local e continuaram na tela depois de recarregar. O grupo de teste foi removido; a tela volta a “Nenhum grupo ainda.”

Motivo: o usuário pediu para testar localmente com Postgres normal, sem Supabase.

Arquivos:

- `compose.yaml`
- `.env.example`
- `apps/backend/package.json`
- `pnpm-lock.yaml`
- `apps/backend/src/grupos/adaptadores/outbox-publicador.ts`
- `.cursor/rules/docker.mdc`
- `.cursor/rules/teste.mdc`
- `.cursor/rules/hospedagem.mdc`
- `.cursor/agents/docker.md`
- `.cursor/agents/teste.md`

## Sessão exige grupo

O que foi feito: uma sessão passou a exigir grupo. Saiu o bloco Sem grupo da aba Grupos e a opção Sem grupo do diálogo. Sem grupo na tela, Nova sessão pede para criar um grupo antes. O contrato, o Prisma e o Nest recusam sessão sem `groupId`, com a mensagem Escolha um grupo. A migration `20261006160000_sessao_exige_grupo` apaga sessões soltas e torna `group_id` obrigatório. Os botões Adicionar sessão, Editar e Remover dos cartões viraram ícones com nome acessível; Mover continua escrito. No celular os ícones do grupo quebram para a linha de baixo, sem sobrepor o nome. Remover devolve 204 vazio, e o BFF deixa de transformar essa resposta em erro.

Motivo: a sessão organiza lançamentos dentro de um grupo, e as ações do cartão precisavam caber como ícones.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/api/_lib/backend.ts`
- `apps/backend/src/grupos/`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261006160000_sessao_exige_grupo/migration.sql`
- `packages/contracts/src/index.ts`

## Busca em grupos

O que foi feito: a tela de grupos ganhou um campo de busca. O texto filtra o grupo pelo nome e pela descrição, e a sessão pelo nome, pela descrição e pela justificativa, sem acento. Grupo que combina mostra as sessões dele. Se só a sessão combina, o grupo abre com essa sessão. Sem resultado, a lista avisa que nada foi encontrado.

Motivo: a pessoa pediu busca na aba de grupos.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`

## Atributos da sessão

O que foi feito: a sessão passou a guardar justificativa, início e fim, além do nome, da descrição, do grupo e do valor que já existiam. A descrição e a justificativa são texto da pessoa e entram no contexto da IA. O início é o primeiro dia do mês da criação, no calendário America/Sao_Paulo, gravado no backend. Não há campo de data na tela. Excluir a sessão grava o fim na data de hoje, tira a sessão da lista e mantém o registro. O nome da sessão aberta continua único no grupo; a encerrada libera o nome. Excluir o grupo ainda apaga as sessões dele. Sessões já gravadas ficam sem início e sem fim.

Motivo: a pessoa pediu esses atributos, com o início no mês da criação, o fim na exclusão e o nome único só enquanto a sessão está aberta.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261009224500_atributos_da_sessao/migration.sql`
- `apps/backend/prisma/migrations/20261010030000_nome_da_sessao_aberta/migration.sql`
- `apps/backend/src/grupos/`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/frontend/app/grupos/page.tsx`

## Encerramento da sessão no domínio

O que foi feito: o mês de início e o dia do fim passaram para o domínio de grupos. O Prisma só grava a data que o serviço manda. Excluir a sessão emite `encerrar-sessao`. Excluir o grupo emite `remover-sessao`, então o apagamento da linha entra no outbox mesmo depois do encerramento. Uma segunda exclusão, inclusive ao mesmo tempo, responde sucesso quando a sessão já tem fim. Lançamento em sessão encerrada é recusado no backend.

Motivo: a revisão de arquitetura apontou regra no adaptador, comando que não era idempotente, outbox pulado e lançamento aceito em sessão encerrada.

Arquivos:

- `apps/backend/src/grupos/dominio/sessao.ts`
- `apps/backend/src/grupos/dominio/sessao.spec.ts`
- `apps/backend/src/grupos/`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `packages/contracts/src/index.ts`

## Grupos no Prumo

O que foi feito: a tela de grupos alinhou o espaçamento à escala, o diálogo passou a usar gap, o chip deixou de herdar a fonte do título e as linhas da lista ficaram no ritmo `px-4 py-3`.

Motivo: a pessoa pediu a tela de grupos no estilo do Prumo.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`

## Tipo da sessão na edição: Fixo ou Acúmulo

O que foi feito: a edição da sessão passa a permitir trocar o tipo. "Fixo" é o nome na tela do tipo valor (antes "Valor único"); o valor guardado continua `valor`/`acumulo`.

- `packages/contracts`: `ROTULO_DO_TIPO_DE_SESSAO`.
- Backend: `PATCH sessoes/:id` aceita `kind` opcional. O domínio ganhou `podeTrocarDeTipo` e `MENSAGEM_DA_TROCA_DE_TIPO`: virar Acúmulo é sempre seguro; virar Fixo só cabe com no máximo uma transação ativa, e ela precisa ser única (a cancelada não conta). O repositório confere os lançamentos da sessão na mesma transação, devolve `tipo` quando não cabe e só grava `kind` no evento `atualizar-sessao` do outbox quando o tipo muda. O serviço responde 409 Conflito com a mensagem.
- Frontend: a tela de grupos mostra o seletor Fixo/Acúmulo também na edição, envia `kind` no PATCH e usa o rótulo novo. Os textos "valor único" viraram "fixa" em Finanças e nas duas mensagens do `financas.service.ts` ("Esta sessão fixa já foi lançada.").
- O assistente e o contrato técnico seguem com `valor`/`acumulo`.

Motivo: a pessoa precisa corrigir o tipo de uma sessão já criada, sem perder o lançamento que não cabe no tipo novo.

Testes: 5 casos de `podeTrocarDeTipo` em `sessao.spec.ts` e `grupos.service.spec.ts` novo com 3 casos; backend com 360 testes passando, `tsc` do backend e do frontend limpos, eslint sem achado.

Verificado na tela (backend e frontend rodando fora do Docker): o seletor aparece na edição; trocar Contas (vários lançamentos, categorias fixa e parcela) para Fixo é recusado com a mensagem; Viagem (uma única) virou Fixo, o cartão mostrou Fixo, o seletor reaberto veio com Fixo marcado e voltou para Acúmulo; o banco voltou a `acumulo`. Não verificado: o Docker não foi reconstruído (rede do container ao npm); o app mobile não tem tela de grupos.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/grupos/grupos.controller.ts`
- `apps/backend/src/grupos/dominio/sessao.ts`
- `apps/backend/src/grupos/dominio/sessao.spec.ts`
- `apps/backend/src/grupos/portas/grupos-repositorio.ts`
- `apps/backend/src/grupos/adaptadores/prisma-grupos-repositorio.ts`
- `apps/backend/src/grupos/aplicacao/grupos.service.ts`
- `apps/backend/src/grupos/aplicacao/grupos.service.spec.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/financas/page.tsx`

## Fixo é uma transação por mês

O que foi feito: a sessão Fixo passou a guardar uma transação única por mês, e não uma para sempre. Acúmulo continua recebendo várias no mês. O mês seguinte começa livre nos dois tipos.

- **Contrato:** `Sessao.available` saiu; entrou `occupiedMonths`, a lista dos meses ("AAAA-MM") em que a Fixo já tem a transação, com o valor dela e o total com as partes. `mesOcupado` e `sessaoAceitaNoMes` leem isso para um mês.
- **Backend:** `aceitaLancamento`, `podeTrocarDeTipo` e `protegeValorBase` olham o mês da transação (`startYear`/`startMonth`). Virar Fixo cabe quando todas as ativas são únicas e nenhum mês tem mais de uma. A recusa "valor-lancada" nas Finanças só olha as transações do mês do pedido. `lancamentoDaSessaoFixa` recebe o mês: a Conferência cruza a linha com a transação do mês da linha, e uma linha de outro mês cria a transação daquele mês. A mensagem de recusa deixou de falar em "outro mês".
- **Frontend:** a Conferência marca "Fixo já lançado neste mês" conforme o mês da tela, e a marca muda ao trocar de mês. O formulário de Finanças tira a Fixo da lista só no mês da data escolhida. O mobile faz o mesmo na Conferência.

Motivo: um seguro lançado em outubro numa sessão Fixo bloqueava setembro e agosto, porque o sistema entendia Fixo como "uma transação só". A pessoa definiu que Fixo é "uma por mês".

Verificação: 449 testes no backend (o domínio da sessão ganhou os casos por mês: aceitar outro mês, meses ocupados, troca de tipo com uma única por mês, base protegida só no mês dela); tsc limpo em backend, frontend, agents e mobile; lint limpo.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/grupos/dominio/sessao.ts` e `sessao.spec.ts`
- `apps/backend/src/grupos/adaptadores/prisma-grupos-repositorio.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`, `portas/financas-repositorio.ts` e `aplicacao/financas.service.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/assistente/dominio/resultados.ts` e `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/extratos/conferencia/page.tsx` e `app/financas/page.tsx`
- `apps/mobile/src/paginas/extratos/Conferencia.tsx`
