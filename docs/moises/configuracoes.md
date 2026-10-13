# Configurações

## Preferências da conta

O que foi feito: a conta guarda, no tenant, o nome, um fuso só, o início do workflow, os calendários visíveis na agenda e o tema. Ajustes abre essa tela.

Motivo: a pessoa ajusta esses dados da conta num lugar só.

Arquivos:

- `apps/frontend/app/configuracoes`
- `apps/frontend/app/ajustes/page.tsx`
- `apps/frontend/components/ui/tema.tsx`
- `apps/frontend/app/layout.tsx`
- `apps/backend/src/configuracoes`
- `apps/backend/src/app.module.ts`
- `apps/backend/prisma`
- `packages/contracts/src/index.ts`

## Google Calendar

O que foi feito: cada tenant cadastra o cliente OAuth, conecta, escolhe os calendários Pessoal e Trabalho, sincroniza e desconecta. A URI de retorno usa o host público do navegador.

Motivo: a agenda passa a ler os calendários do Google dessa conta.

Arquivos:

- `apps/frontend/app/configuracoes`
- `apps/frontend/app/api/configuracoes`
- `apps/frontend/app/api/_lib/origem.ts`
- `apps/backend/src/configuracoes`
- `apps/backend/src/agenda`
- `apps/backend/prisma`

## Modelos de IA

O que foi feito: a conta cadastra os modelos e marca qual está em uso. Não há lista pré-definida. Sem modelo, a leitura pede o cadastro. Chave vazia no salvar mantém a gravada.

Motivo: a leitura de foto e PDF usa o modelo e a chave que a conta escolheu.

Arquivos:

- `apps/frontend/app/configuracoes`
- `apps/backend/src/configuracoes`
- `apps/backend/prisma`
- `packages/contracts/src/index.ts`

## Foto e PDF do extrato

O que foi feito: foto ou PDF entra na lista como processando. O status mostra o resultado ou o erro. Se o modelo recusa temperatura zero, a leitura segue com a temperatura padrão.

Motivo: a pessoa acompanha a leitura na lista, e o modelo que recusa temperatura zero ainda lê o arquivo.

Arquivos:

- `apps/frontend/app/extratos/page.tsx`
- `apps/backend/src/extratos`
- `apps/agents/src/extratos`

## Conferência

O que foi feito: a conferência busca e pagina de 20 em 20. Acumular uma linha numa sessão aberta grava o nome normalizado em `statement_aliases`. A próxima linha igual entra direto nessa sessão.

Motivo: a pessoa revisa as linhas, e a próxima de mesmo nome já cai na sessão escolhida.

Arquivos:

- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/frontend/app/api/extratos/acumular/route.ts`
- `apps/backend/src/extratos`
- `apps/backend/prisma`
- `packages/contracts/src/index.ts`

## Finanças

O que foi feito: dá para apagar lançamento que não veio do extrato, na Base e no formulário. Lançamento sincronizado não apaga. A visão por grupo não apaga grupo nem sessão. Sessão encerrada sai de Finanças. O exemplo não é recriado quando não há grupo. Apagar grupo remove lançamentos sem extrato; com lançamento sincronizado, o grupo permanece.

Motivo: a pessoa apaga o que lançou à mão, e o grupo só some quando nenhum lançamento veio do extrato.

Arquivos:

- `apps/frontend/app/financas`
- `apps/frontend/app/api/lancamentos/[id]/route.ts`
- `apps/backend/src/financas`
- `apps/backend/src/grupos/adaptadores/prisma-grupos-repositorio.ts`
- `packages/contracts/src/index.ts`

## Fuso da agenda

O que foi feito: Agenda e configurações usam um fuso só para Pessoal e Trabalho.

Motivo: os dois calendários passam a marcar o dia no mesmo fuso.

Arquivos:

- `apps/frontend/app/agenda`
- `apps/frontend/app/configuracoes`
- `apps/frontend/app/eventos/page.tsx`
- `apps/backend/src/agenda`
- `apps/backend/src/configuracoes`

## Menu lateral

O que foi feito: o menu lateral permanece no lugar enquanto o conteúdo rola.

Motivo: a pessoa troca de tela sem perder o menu de vista.

Arquivos:

- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/app/layout.tsx`
- `apps/frontend/app/globals.css`

## Portas e eventos

O que foi feito: a configuração fala com o Google por uma porta. Conectar, desconectar e a mudança de fuso da conta gravam o evento na mesma transação, sem segredo no payload. A associação de nome inclui a sessão na marca, então trocar a sessão do mesmo nome gera evento novo.

Motivo: o registro acompanha a mudança de estado, e o evento não repete o segredo.

Arquivos:

- `apps/backend/src/configuracoes`
- `apps/backend/src/agenda`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `packages/contracts/src/index.ts`
