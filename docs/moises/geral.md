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

## Animações com Motion

O que foi feito: os modais passaram a usar o componente `Dialogo`, que entra subindo com fade e sai encolhendo. O fundo escurece e clareia junto. Escape, Cancelar, clique fora e `close()` passam pela saída. Quando o modal segue um estado (`aberto`), o conteúdo e a largura ficam congelados até ele sumir, para o título não trocar no meio. Os toasts entram pela direita, saem pelo mesmo lado e os outros escorregam para o lugar. A dica aparece com fade. O acordeão do grupo e o da visão geral no celular abrem e fecham pela altura. A lista de metas e a de extratos entram em cascata, e a barra da meta cresce até o progresso. A chave das configurações desliza com mola. Quem pede menos movimento no sistema fica só com a opacidade. O `Presenca` saiu; o modal do dia da agenda usa o `Dialogo`.

Motivo: a pessoa pediu para usar o Motion no app todo.

Arquivos:

- `apps/frontend/components/ui/dialogo.tsx`
- `apps/frontend/components/ui/movimento.tsx`
- `apps/frontend/components/ui/toast.tsx`
- `apps/frontend/components/ui/rotulo.tsx`
- `apps/frontend/app/layout.tsx`
- `apps/frontend/app/globals.css`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/configuracoes/painel.tsx`
- `apps/frontend/app/eventos/page.tsx`
- `apps/frontend/app/extratos/page.tsx`
- `apps/frontend/app/financas/acoes.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/virada.tsx`
- `apps/frontend/app/financas/visao-geral.tsx`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/metas/page.tsx`

## Visual no estilo do Motion

O que foi feito: o visual passou a seguir o site do Motion. A fonte é TASA Orbiter, com títulos em negrito e letras juntas. Navegação, botões, chips, rótulos de número e dias da semana usam Geist Mono em maiúsculas espaçadas. Os cantos ficaram retos. O claro é off-white e o escuro é quase preto, com camadas e bordas no tom do Motion. A cor da marca virou azul, usada no item ativo, no selecionado e no que está ok. O botão principal ficou amarelo com texto escuro. A navegação tem fundo de pontos, ocupa a altura da tela e marca a aba ativa com uma barra que desliza. Os tons suaves (marca, evento e pendente) são opacos, para não deixar a borda da grade aparecer por baixo. A regra `font: inherit` do botão foi para a camada base, para a fonte mono do botão valer.

Motivo: a pessoa pediu que o visual parecesse com o do Motion.

Arquivos:

- `apps/frontend/app/globals.css`
- `apps/frontend/app/layout.tsx`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/components/ui/button.tsx`
- `apps/frontend/components/ui/chip.tsx`
- `apps/frontend/components/ui/stat.tsx`
- `apps/frontend/components/ui/page-header.tsx`
- `apps/frontend/components/ui/toast.tsx`
- `apps/frontend/components/ui/dialogo.tsx`
- `apps/frontend/app/agenda/grade.tsx`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/agenda/lista.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/page.tsx`

## Sincronia da interface com o sistema

O que foi feito: a edição de lançamento fora da trava passou a enviar parcelas, vencimento, juros, recorrência e intervalo do formulário; antes enviava os valores gravados e o "Lançamento atualizado." não mudava nada. A agenda lê o estado do Google das configurações: o subtítulo mostra o estado real, o aviso de conexão só aparece desconectado e o botão abre a conexão do Google (ou leva a Configurações quando falta o ID e o segredo), em vez de chamar a sincronização. O rótulo do estado do Google foi para `contracts`, usado pela agenda e pelas configurações. A mensagem de linhas cortadas do extrato mostra "as primeiras N de M". Os modais de excluir meta e extrato limpam o estado no `onClose`, e o de detalhes do evento segue `aberto`, sem efeito com `showModal`. A regra de botão do CSS foi para a camada base, então a cor de utilitário vale em todo botão. Os seletores de Dashboard, Agenda, Finanças, Eventos e Aparência usam o `Segmentado`, com o fundo da opção deslizando. As setas dos acordeões usam a `Seta` com Motion. O `Button` ganhou a variante `link`, para o tipo de evento e o dia ou mês do painel não virarem maiúsculas. Cabeçalhos de tabela usam `etiqueta`. Conferência e a ação de valor do lançamento deixam de ter vários botões amarelos. Os botões de editar e excluir da agenda têm 40 px e foco visível. A árvore de Configurações usa etiqueta e a barra azul da navegação. `Money` acumulado usa `pos-soft` e `neg-soft` opacos. A casca não estica a linha da navegação em página curta no celular.

Motivo: a pessoa pediu para encontrar os erros e a falta de sincronia da interface com o sistema.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/frontend/app/globals.css`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/components/ui/button.tsx`
- `apps/frontend/components/ui/chip.tsx`
- `apps/frontend/components/ui/money.tsx`
- `apps/frontend/components/ui/movimento.tsx`
- `apps/frontend/components/ui/segmentado.tsx`
- `apps/frontend/components/ui/stat.tsx`
- `apps/frontend/app/page.tsx`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/agenda/grade.tsx`
- `apps/frontend/app/agenda/lista.tsx`
- `apps/frontend/app/configuracoes/painel.tsx`
- `apps/frontend/app/eventos/page.tsx`
- `apps/frontend/app/extratos/page.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/frontend/app/financas/acoes.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/tabela.tsx`
- `apps/frontend/app/financas/visao-geral.tsx`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/metas/page.tsx`
- `apps/frontend/app/relatorios/page.tsx`

## Vínculo, avisos e visual

O que foi feito: o painel passa a preencher o vínculo do compromisso com o lançamento, para o dashboard mostrar o valor em vez do texto "Compromisso". Vincular um compromisso na agenda grava os dois lados: o compromisso aponta o lançamento e o lançamento aponta o compromisso. O vínculo anterior é desfeito. A agenda devolve o estado real do Google (desconectado, sincronizando, sincronizado ou erro), lido das configurações. Eventos de configuração (salvar, iniciar, conectar e desconectar o Google) caem na categoria configuracoes, que fica ativa. Com categorização em "aplicar", a conferência do extrato confirma a proposta sozinha. A validade das ações pendentes (pendingHours) expira a proposta a partir da importação do extrato. Lembretes de compromisso e vencimentos de lançamento passam a aparecer como avisos no dashboard quando o aviso no aplicativo está ligado. A antecedência do lembrete é a das configurações. O aviso por e-mail continua sem destino, porque a conta ainda não tem e-mail. Na lista de ocorrências, uma ocorrência pendente e não sincronizada pode mudar a data e o valor. O tom âmbar fica só na sugestão da IA. Status pendente, prioridade baixa, descumprido e pagamento pendente usam o tom padrão. Saíram larguras mínimas arbitrárias de tabela e de coluna. A altura da célula da agenda foi devolvida de propósito para 68 px no celular e 108 px a partir do tablet, porque a pessoa rejeitou a grade menor. A caixa de lista vazia virou o componente Vazio, a classe dos inputs virou campo, e os ícones de adicionar, editar e excluir viraram o componente Icone.

Motivo: a pessoa apontou esses furos no dashboard, no vínculo, no Google, nos eventos, nas configurações, na ocorrência e no visual.

Arquivos:

- `apps/backend/src/painel`
- `apps/backend/src/agenda`
- `apps/backend/src/extratos`
- `apps/backend/src/configuracoes`
- `apps/frontend/app`
- `apps/frontend/components/ui`
- `packages/contracts`
