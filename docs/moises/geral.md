# Geral

## Toasts de sucesso, erro e alerta

O que foi feito: mensagens de sucesso, erro e alerta do frontend passaram a aparecer num toast, no canto superior direito, por cima dos diálogos. Os três somem sozinhos depois de 5 segundos. O fechar é um ícone de X. O texto que era só feedback (falha ao carregar, validação de formulário, falha ao salvar e confirmação de ação) saiu do corpo da página. O que é dado da tela continua lá: erro de linha de extrato, mensagem de extrato que falhou, chips e estados vazios. Carregando continua no corpo da página.

Motivo: a pessoa pediu que sucesso, erro e alerta fossem mostrados por um toast.

Arquivos:

- `apps/frontend/components/ui/toast.tsx`
- `apps/frontend/app/globals.css`
- `apps/frontend/app/layout.tsx`
- `apps/frontend/app/page.tsx`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/metas/page.tsx`
- `apps/frontend/app/relatorios/page.tsx`
- `apps/frontend/app/eventos/page.tsx`
- `apps/frontend/app/extratos/page.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`

## Confirmação para excluir

O que foi feito: excluir grupo ou sessão abre um modal antes de apagar. O grupo avisa quando as sessões dele também saem. Meta e extrato já pediam essa confirmação.

Motivo: a pessoa pediu confirmação em modal para excluir qualquer coisa do sistema.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`

## Versionamento

O que foi feito: a regra passou a ter uma branch por tela, reutilizada nas atualizações dessa tela, e uma branch só para o sistema inteiro, `moises/geral`. O toast e a confirmação de exclusão saíram de `moises/avisos` e ficaram nesta branch.

Motivo: a pessoa não quer uma branch nova para cada assunto que atravessa o sistema.

Arquivos:

- `.cursor/rules/versionamento.mdc`
- `docs/moises/geral.md`

## Modal e rolagem

O que foi feito: os diálogos ficam no centro, na largura de um formulário (28rem; tabelas usam 42rem ou 48rem), com folga da borda da tela. A altura acompanha o conteúdo até o limite da viewport. O miolo rola; Salvar, Cancelar e o equivalente ficam fixos embaixo. A rolagem de todas as telas usa a mesma barra fina, com o polegar na cor do texto secundário e o trilho transparente, no claro e no escuro.

Motivo: o modal estava quase da largura da tela e os botões sumiam quando o formulário rolava.

Arquivos:

- `apps/frontend/app/globals.css`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/acoes.tsx`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/metas/page.tsx`
- `apps/frontend/app/eventos/page.tsx`
- `apps/frontend/app/extratos/page.tsx`
- `apps/frontend/app/agenda/page.tsx`

## Formulário do lançamento

O que foi feito: o modal de lançamento ficou só com campos. Some o texto que explicava o sinal do valor e o que justificava um campo ausente. Os pares cabem na largura do diálogo, e a barra de rolagem fica afastada dos controles.

Motivo: a barra encostava nos campos e as frases no meio da grade deixavam o formulário irregular.

Arquivos:

- `apps/frontend/app/globals.css`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/acoes.tsx`
- `apps/frontend/app/financas/rotulos.ts`

## Fechar o diálogo

O que foi feito: o diálogo fechado volta a sumir. O `display: flex` do modal só vale com ele aberto.

Motivo: depois de cancelar o lançamento, o formulário continuava na tela e não havia como tirá-lo.

Arquivos:

- `apps/frontend/app/globals.css`
- `apps/frontend/app/financas/page.tsx`

## Filtro da base

O que foi feito: na base, ano, mês e dia são filtros separados. O dia fica desabilitado enquanto o mês não for escolhido.

Motivo: o mês vinha junto com o ano e não dava para filtrar o dia.

Arquivos:

- `apps/frontend/app/financas/tabela.tsx`

## Prioridade e status

O que foi feito: na base e na visão geral, status e prioridade aparecem em etiquetas. Pendente, paga e cancelada têm cor; prioridade alta fica em vermelho e baixa em âmbar.

Motivo: as transações não deixavam status e prioridade identificáveis.

Arquivos:

- `apps/frontend/app/financas/rotulos.ts`
- `apps/frontend/app/financas/tabela.tsx`
- `apps/frontend/app/financas/visao-geral.tsx`

Na visão geral, as etiquetas de tipo, status e prioridade foram retiradas. Elas ficam na base.

## Ano do fixo e virada

O que foi feito: lançamento fixo só entra no ano em que começa. Parcela e empréstimo continuam podendo passar para o ano seguinte. A partir de 1º de janeiro, ao abrir Finanças, a tela pergunta quais grupos e sessões permanecem.

Motivo: o fixo não deve ser contado no ano que vem, e a troca de ano precisa escolher o que continua.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/financas/dominio/regras.spec.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261012120000_permanencia_do_ano/migration.sql`
- `apps/backend/src/grupos/`
- `apps/frontend/app/api/grupos/virada/route.ts`
- `apps/frontend/app/financas/virada.tsx`
- `apps/frontend/app/financas/page.tsx`

## Ano sem lançamento

O que foi feito: na visão geral, um ano sem grupo, sessão ou lançamento mostra só a mensagem no centro da grade. Entradas, saídas e sobras ficam de fora.

Motivo: zeros não informam nada quando o ano seguinte ainda não tem movimento.

Arquivos:

- `apps/frontend/app/financas/visao-geral.tsx`

## Cor do acumulado

O que foi feito: soma do grupo, coluna Total, entradas, saídas, sobra e o total da base ganham a cor do sinal mais forte, com fundo na mesma cor.

Motivo: o valor acumulado precisa se distinguir do lançamento do mês.

Arquivos:

- `apps/frontend/components/ui/money.tsx`
- `apps/frontend/app/financas/visao-geral.tsx`
- `apps/frontend/app/financas/tabela.tsx`

## Troca de mês na agenda

O que foi feito: ao mudar o mês, a grade e a lista permanecem até a agenda daquele mês chegar. A frase de carregamento fica só na primeira abertura.

Motivo: a tela apagava o calendário e piscava a cada seta.

Arquivos:

- `apps/frontend/app/agenda/page.tsx`

## Modal do dia

O que foi feito: ao abrir uma data, o diálogo mostra a quantidade e o total, e cada item traz horário, valor, categoria, situação e a ação de cumprir. O clique duplo no dia abre esse diálogo.

Motivo: o dia aberto precisa ser lido como uma lista, com o valor e o status à vista.

Arquivos:

- `apps/frontend/app/agenda/lista.tsx`
- `apps/frontend/app/agenda/grade.tsx`
- `apps/frontend/app/agenda/page.tsx`

## Movimento

O que foi feito: a interface passa a usar a biblioteca Motion. Trocar de aba, de mês e abrir o dia animam a entrada e a saída. Quem prefere menos movimento no sistema não vê a animação.

Motivo: as trocas de tela aconteciam secas.

Arquivos:

- `apps/frontend/package.json`
- `pnpm-lock.yaml`
- `apps/frontend/components/ui/movimento.tsx`
- `apps/frontend/app/template.tsx`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/agenda/lista.tsx`

## Movimento nas abas

O que foi feito: a marca da aba desliza no menu e o conteúdo entra na direção da aba escolhida. Dentro de Dashboard, Finanças, Relatórios, Eventos e Conferência, a troca de visão ou de período também desliza.

Motivo: o movimento precisa valer para o sistema inteiro, não só para a agenda.

Arquivos:

- `apps/frontend/components/ui/movimento.tsx`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/app/template.tsx`
- `apps/frontend/app/page.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/relatorios/page.tsx`
- `apps/frontend/app/eventos/page.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`

## Cursor

O que foi feito: o ponteiro do mouse passou a ser a seta do Prumo, na cor da marca, com um losango no corpo. No tema escuro a seta clareia. Campo de texto continua com o cursor de escrita.

Motivo: o cursor precisa ser reconhecível como parte deste sistema.

Arquivos:

- `apps/frontend/app/globals.css`
- `apps/frontend/public/cursor.svg`
- `apps/frontend/public/cursor-dark.svg`

## Valor no campo

O que foi feito: os campos de valor de lançamento, de atualização do fixo e de meta formatam os centavos enquanto a pessoa digita, no padrão 1.234,56.

Motivo: o valor precisa entrar como num campo de banco.

Arquivos:

- `apps/frontend/app/financas/reais.ts`
- `apps/frontend/app/financas/campo-valor.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/acoes.tsx`
- `apps/frontend/app/metas/page.tsx`

## Explicação do campo

O que foi feito: cada campo com título ganhou um ícone de exclamação. Ao passar o mouse, uma frase curta explica o campo.

Motivo: o título sozinho não diz o que preencher.

Arquivos:

- `apps/frontend/components/ui/rotulo.tsx`
- `apps/frontend/app/globals.css`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/acoes.tsx`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/metas/page.tsx`
- `apps/frontend/app/extratos/page.tsx`

## Espaço dos títulos e foco do checkbox

O que foi feito: os títulos dos diálogos de grupo e de sessão ficam com o espaço `mb-4` antes do formulário. O checkbox que filtra linhas com erro no extrato mostra o anel de foco.

Motivo: o título encostava no campo e o checkbox não deixava o foco visível.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/extratos/page.tsx`

## Confirmação simultânea da virada

O que foi feito: se duas confirmações da virada correm juntas e a sessão já foi encerrada pela outra, a transação desfaz e a chamada termina sem erro.

Motivo: a segunda confirmação não pode falhar depois que a primeira já gravou o encerramento.

Arquivos:

- `apps/backend/src/grupos/adaptadores/prisma-grupos-repositorio.ts`

## Leitura de extrato no agents

O que foi feito: `apps/agents` passou a ser TypeScript, com LangChain e LangGraph, no lugar de Python e FastAPI. O processo não grava no Postgres. O contrato `PedidoOrganizarExtrato` ficou em `packages/contracts`.

Motivo: o agents entra no workspace TypeScript do monorepo e não acessa o banco.

Arquivos:

- `apps/agents`
- `apps/frontend/Dockerfile`
- `apps/backend/Dockerfile`
- `compose.yaml`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `packages/contracts/src/index.ts`
- `.cursor/rules/tecnologias.mdc`
- `.cursor/rules/arquitetura.mdc`
- `.cursor/rules/monorepo.mdc`
- `.cursor/rules/hospedagem.mdc`
- `.cursor/rules/docker.mdc`

## Edição do compromisso

O que foi feito: o compromisso pode ser atualizado e apagado. Na grade, o dia muda de fundo com o mouse e fica marcado ao clicar. O modal do dia mostra o lápis e a lixeira em cada compromisso. Arrastar para outro dia muda a data. Na lista e no dia, o título também abre a edição. O diálogo tem Salvar e Excluir, com confirmação. Apagar solta o lançamento que apontava para o compromisso. Uma repetição movida passa a começar no dia novo. O evento de atualizar é atualizar-compromisso e o de apagar é excluir-compromisso.

Motivo: a agenda só criava compromisso e mudava o status.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/agenda/aplicacao/agenda.service.ts`
- `apps/backend/src/agenda/aplicacao/ocorrencias.ts`
- `apps/backend/src/agenda/aplicacao/ocorrencias.spec.ts`
- `apps/backend/src/agenda/adaptadores/prisma-agenda-repositorio.ts`
- `apps/backend/src/agenda/agenda.controller.ts`
- `apps/backend/src/agenda/portas/agenda-repositorio.ts`
- `apps/frontend/app/api/compromissos/[id]/route.ts`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/agenda/grade.tsx`
- `apps/frontend/app/agenda/lista.tsx`
