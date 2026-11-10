# Agenda: checklist do compromisso

## Compromisso com checklist

A pessoa quer que um compromisso tenha a própria lista de checklist, na mesma tela das tarefas. Um item do checklist é uma tarefa ligada ao compromisso, no dia da ocorrência (`date`).

O que foi feito:

- Banco: `Task.appointmentId` (coluna `appointment_id`), com índice por tenant, compromisso e dia e chave estrangeira com apagar em cascata. A migração é `20261110090000_checklist_do_compromisso`. Quando o compromisso é apagado, o checklist vai junto.
- Regras: a subatividade herda o compromisso e o dia da atividade. O item do checklist não repete e não passa para o dia seguinte; a tarefa solta continua passando. Editar o item muda só o texto. Quando uma tarefa vai para dentro de um item, a árvore dela entra no checklist.
- Compromisso que repete (semanal, periódico ou anual) tem um checklist por dia. `POST compromissos/:id/checklist/copiar {date}` copia o checklist da última data anterior que tinha um, com todos os itens abertos. Recusa se o dia já tem checklist ou se não há data anterior com checklist. Operação de outbox nova: `copiar-checklist`.
- Contratos: `Tarefa.appointmentId`, `PedidoDeTarefa.appointmentId`, `CompromissoDoDia.repeats` e `PedidoDeCopiaDoChecklist`.
- Hoje (backend): `listarDoDia` recebe os compromissos do dia e devolve o checklist de cada um nesse dia, junto com as tarefas soltas.
- Tela Hoje (web): cada compromisso mostra o checklist embaixo, com subatividades, arrastar, editar e apagar como nas tarefas, e um botão "+ Item". O menu do compromisso tem "Item do checklist" e, se o compromisso repete e ainda não tem checklist no dia, "Trazer o checklist da última vez". A linha de baixo do compromisso mostra "Checklist N de M". As tarefas com compromisso saem de "Para fazer" e "Feito". A edição do item mostra só o texto. BFF novo em `app/api/compromissos/[id]/checklist/copiar/route.ts`.
- Celular (Hoje): o checklist aparece embaixo de cada compromisso, com a contagem. O "+" do compromisso abre um alerta para escrever o item ou trazer o checklist da última vez.
- IA: `criar_tarefa` aceita `appointmentId`, há uma ferramenta nova `copiar_checklist_do_compromisso` e o prompt explica o checklist.

Motivo: a pessoa quer que um compromisso tenha a própria lista de checklist, na mesma tela das tarefas.

Verificação: sonda na API do ambiente local.

- Itens no compromisso de 10/11, com subatividade, aparecem nesse dia e não no dia 11.
- Concluir o item fechou a subatividade.
- Editar o dia do item não mudou o dia.
- O checklist de um compromisso semanal no dia 3 foi copiado para o dia 10 com todos os itens abertos, e o dia 3 não mudou. A segunda cópia deu 409.
- Compromisso inexistente deu 404.
- Depois que os compromissos foram apagados, o banco ficou com 0 itens de checklist.

A tela Hoje foi fotografada em 375 e 1280 px, sem rolagem horizontal. O tsc do backend, do agents, do frontend e do mobile passou limpo, e os testes do mobile passam. No backend, 529 de 532 testes passam. Os 3 que falham são de `src/registrar-pedidos.spec.ts` (registro dos pedidos HTTP): esse arquivo não foi tocado e falha também quando roda sozinho.

Atenção ao subir: a migração roda sozinha.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261110090000_checklist_do_compromisso/` (novo)
- `packages/contracts/src/index.ts`
- `apps/backend/src/hoje/` (`adaptadores/prisma-tarefas-repositorio.ts`, `portas/tarefas-repositorio.ts`, `aplicacao/hoje.service.ts` e o spec, `dominio/subtarefas.spec.ts`, `hoje.controller.ts`)
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/hoje/page.tsx`
- `apps/frontend/app/api/compromissos/[id]/checklist/copiar/route.ts` (novo)
- `apps/mobile/src/paginas/Hoje.tsx`
- `apps/mobile/src/paginas/hoje/dia.spec.ts`

## Checklist na criação do compromisso e tarefa levada para um compromisso

O que foi feito:

- Agenda: a criação do compromisso tem a seção Checklist (`checklist-do-rascunho.tsx`). Nela a pessoa escreve o item (Enter ou +), sobe, desce e remove. Depois do POST do compromisso, cada item é criado com `POST /api/tarefas { title, date, appointmentId }`, na ordem, no dia do compromisso. Se algum falhar, o compromisso fica e um aviso diz quantos itens não entraram. Vale só na criação.
- Backend: `PedidoDeMovimento` ganhou `appointmentId` e `date`. Na raiz, `PATCH tarefas/:id/mover` com `appointmentId` leva a tarefa e a árvore dela para o checklist do compromisso no dia `date` e tira a repetição. Com `null`, a tarefa volta para as soltas no dia `date`. Compromisso inexistente dá 404, e `date` é obrigatório com `appointmentId`. IA: ferramenta nova `associar_tarefa_ao_compromisso`.
- Hoje (web): no menu da tarefa solta, "Levar para um compromisso" abre a escolha entre os compromissos do dia. No item do checklist, "Tirar do checklist". Celular: a folha de edição da tarefa ganhou "No checklist de".
- Lista da Hoje (web): no desktop, duas colunas, com a lista larga e, à direita e fixos ao rolar, o andamento do dia e o quadro Livre. Os títulos quebram em vez de cortar. O detalhe vai para a direita no desktop. O compromisso e o checklist dele ficam ligados por uma barra `border-event` à esquerda.

Motivo: a pessoa quer montar o checklist ao criar o compromisso e levar uma tarefa que já existe para dentro dele.

Verificação: mover para o compromisso e de volta pela API do BFF, com a subatividade junto. Compromisso criado pela tela da Agenda com 3 itens, na ordem escolhida. Fotos em 375, 760 e 1280 px, sem rolagem horizontal. Dados de teste apagados.

Arquivos:

- `apps/frontend/app/agenda/checklist-do-rascunho.tsx` (novo)
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/hoje/page.tsx`
- `apps/mobile/src/paginas/Hoje.tsx`
- `packages/contracts/src/index.ts`
- `apps/backend/src/hoje/` (`adaptadores/prisma-tarefas-repositorio.ts`, `portas/tarefas-repositorio.ts`, `aplicacao/hoje.service.ts`, `hoje.controller.ts`)
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`

## Diálogos de compromisso e de lançamento com abas

O que foi feito:

- Os diálogos de criar e editar compromisso (Agenda) e lançamento (Finanças) ficaram largos e baixos, na largura nova `extra` (64rem). As abas ficam no topo, no estilo da navegação. O corpo tem altura fixa e rola por dentro. Os campos ficam em seções de duas colunas no desktop e de uma no celular. Cancelar e Salvar ficam fixos no rodapé. Campo inválido em outra aba leva para ela, com foco no campo e um ponto vermelho na aba.
- Abas do compromisso: Principal, Repetição, Checklist (só na criação), Gastos e Detalhes.
- Abas do lançamento: Principal, Tipo, Conta, Vencimento (só nas categorias que aceitam a regra; antes ficava em "Mais opções") e Detalhes. Na edição, também Ocorrências e Situação. Abrir pela linha da tabela cai em Ocorrências.
- Nenhum campo saiu, e o backend não mudou.
- Peças novas: `components/ui/abas.tsx` (`useAbas`, `FaixaDeAbas`, `PainelDeAba`, `Secao`), `Painel` em `components/ui/movimento.tsx` (mantém montados os painéis escondidos), a largura `extra` no `Dialogo` e regras em `app/globals.css`.

Motivo: os diálogos estavam altos demais, e as abas deixam cada grupo de campos à vista sem rolar a tela.

Verificação: compromisso repetido com sessão, local, descrição e 2 itens, e parcela 2 de 10 de R$ 450,00 com conta, criados pela tela e conferidos na API. Edição dos dois. Fotos de cada aba em 375, 760 e 1280 px e no tema claro em 1280. Dados de teste apagados.

Pendente: `.claude/rules/interface.md` ainda não cita a largura `extra` nem as peças de abas.

Arquivos:

- `apps/frontend/components/ui/abas.tsx` (novo)
- `apps/frontend/components/ui/movimento.tsx`
- `apps/frontend/components/ui/dialogo.tsx`
- `apps/frontend/app/globals.css`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/acoes.tsx`

## O fuso fica só em Configurações

O que foi feito: a Agenda deixou de ter o seletor de fuso. O fuso aparece no subtítulo e no diálogo do compromisso, com link para Configurações, onde ele é escolhido. Configurações já grava o fuso nas preferências e nas duas agendas (Pessoal e Trabalho).

Motivo: a pessoa quer escolher o fuso num lugar só, em Configurações, para ficar salvo.

Verificação: mudar para `America/Manaus` em Configurações mudou as duas agendas, e voltar para `America/Sao_Paulo` voltou as duas.

Arquivos:

- `apps/frontend/app/agenda/page.tsx`
