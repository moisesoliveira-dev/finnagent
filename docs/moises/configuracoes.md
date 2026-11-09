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

## Desfazer tudo na fila

O que foi feito: o "Desfazer tudo" da conferência entra na fila `extratos` do BullMQ e o endpoint responde na hora com `{ queued: true }` (`ConferenciaDesfazendo` no contrato). Um trabalho por conta de cada vez: pedido repetido enquanto o anterior roda recebe 409. Sem Redis, desfaz na hora, como antes. Ao terminar ou falhar, o serviço grava no outbox o evento `desfazer-conferencia` com `concluido: true`, e a varredura cria o aviso "Conferência desfeita" (com a contagem) ou "Não foi possível desfazer a conferência" (com o motivo), só para quem pediu. O desfazer em lote pula a linha que já não está cruzada ou que sumiu; o de uma linha só continua recusando. Na tela de Configurações, o toast diz que começou e que a central avisa; a dica, o diálogo e a ferramenta `desfazer_conferencia` do assistente explicam que roda em segundo plano. Fica para depois juntar as idas ao banco de cada linha numa transação só.

Motivo: o desfazer passava do prazo da tela e, clicado de novo, esbarrava em si mesmo.

Verificação: testes do backend passando, com casos novos para o aviso e para a linha já solta; tsc e lint limpos. Pelo BFF local, dois pedidos simultâneos deram `queued` e 409, as linhas voltaram a pendentes, os lançamentos da linha sumiram e um terceiro pedido entrou na fila de novo. Não verificado o aviso na central, porque o tenant local não tem usuário.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/extratos/adaptadores/fila-de-conferencia.ts` (novo)
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts` e `extratos.service.lote.spec.ts`
- `apps/backend/src/extratos/extratos.controller.ts`
- `apps/backend/src/extratos/extratos.module.ts`
- `apps/backend/src/notificacoes/adaptadores/agendador.ts`
- `apps/backend/src/notificacoes/aplicacao/varredura.service.ts`
- `apps/backend/src/notificacoes/dominio/avisos.ts` e `avisos.spec.ts`
- `apps/frontend/app/configuracoes/painel.tsx`

## A lembrança de nome e sessão vale em qualquer mês

O que foi feito: a chave que a Conferência usa para lembrar a sessão e o nome de uma linha (`chaveDoNome`) passou a ignorar acento e pontuação. Fica só com letras sem acento e números, separados por espaço. A migração `20261109120000_chave_do_nome_sem_pontuacao` refaz as chaves gravadas em `statement_names` e `statement_aliases` com a mesma regra e junta as que ficam iguais. Nos nomes, os usos se somam. Nas associações, fica a que aponta para um lançamento.

Causa: a leitura dos PDFs escreve a mesma compra com hífen num mês ("Compra no débito via NuPay - Uber", agosto) e com travessão em outro ("NuPay — Uber", setembro e outubro). A chave era o texto exato, então o que a pessoa ensinava num mês não valia nos outros.

Motivo: a sessão e o nome lembrados precisam valer para a mesma compra em qualquer mês.

Verificação: testes novos de `chaveDoNome` para hífen, travessão, acento e pontuação. O estorno continua com chave diferente. No banco local, 10 associações viraram 7, e a Conferência de setembro e outubro passou a sugerir para "MP *NOVAIGREJABATISTA" a sessão ensinada em agosto. A transferência para pessoa continua sem lembrança, por regra.

Atenção ao subir: a migração roda sozinha quando o `backend` sobe e reescreve as chaves de produção.

Arquivos:

- `apps/backend/src/extratos/dominio/nome-extrato.ts` e `nome-extrato.spec.ts`
- `apps/backend/prisma/migrations/20261109120000_chave_do_nome_sem_pontuacao/migration.sql` (novo)

## Ações do assistente numa linha que abre

O que foi feito: no chat, várias ações seguidas viram uma linha só. A linha mostra a ação em foco, que é a que está rodando ou a última, e troca com animação conforme as próximas chegam. Ela traz a contagem ("3/16" enquanto roda, "16 ações" no fim) e, quando alguma ação falhou, um chip vermelho e a borda vermelha. O clique abre a lista inteira (`Expandir`), com `aria-expanded`. Uma ação sozinha aparece como antes. O ícone do estado virou o componente `IconeDaAcao`, que os dois casos usam.

Motivo: a lista de consultas ocupava a tela inteira da conversa.

Verificação: tsc e eslint limpos. Uma conversa de teste foi gravada no banco local e fotografada no Chrome em 1280 e 375 px, com a lista fechada e aberta, sem rolagem lateral. Depois ela foi apagada.

Arquivos:

- `apps/frontend/app/assistente/mensagem.tsx`

## Parcela e recorrente juntam a mesma compra de outros meses importados

O que foi feito:

- Na Conferência, ao lançar uma linha como parcela, empréstimo ou recorrente, a tela chama antes `POST extratos/series/previa`. Ela devolve, por mês, as linhas livres de todos os meses importados que são a mesma compra: mesma chave de descrição (sem acento nem pontuação) e mesmo sentido. Ficam até 3 linhas por mês, as de valor mais perto. Parcela e empréstimo só valem nos meses em que a parcela cai de 1 até o total, contando da parcela informada. Recorrente só procura se for mensal. Transferência para pessoa não procura.
- Se houver outras linhas, abre o diálogo "… aparece em outros meses". Ele mostra cada mês com data, descrição e valor de cada linha, e a parcela daquele mês quando há uma. Cada mês pode ser marcado ou desmarcado; o mês da linha de origem não sai. Num mês com mais de uma linha, a pessoa escolhe "Somar no mês" ou "Só uma", e no "Só uma" escolhe qual linha. Botões: "Lançar juntas", "Só esta linha" e "Cancelar".
- `POST extratos/series` cria a série no mês mais antigo escolhido, com a parcela daquele mês. Cada linha seguinte, em ordem, paga a ocorrência do seu mês no valor do extrato. As linhas "parte" (somar no mês) viram únicas pagas na mesma sessão, com `emPartes`, como na sessão Fixo. Uma linha que falha não derruba as outras: o resultado diz `launched` e `failed`.
- Séries que já existem: `GET extratos/series` lista as parcelas, empréstimos e recorrentes abertos com linhas livres em outros meses. As chaves são as associações lembradas e as descrições das linhas que já pagaram a série. Entram os meses com ocorrência pendente e os meses antes da primeira ocorrência (o mês anterior importado depois). A Conferência mostra o aviso "Parcelas e recorrentes com linhas em outros meses", com "Ver e lançar", no mesmo diálogo. `POST extratos/series/:id/linhas` junta as linhas. Na parcela e no empréstimo, a linha anterior ao início paga a próxima parcela em aberto, como a regra de pagar em qualquer mês. Na recorrente, que não tem ocorrência antes do início, a linha desse mês entra como única na mesma sessão, com o nome da série.
- A recorrente não é estendida para trás porque editar a data junta as ocorrências pelo número, e a paga de outubro tomaria o lugar de agosto.
- Assistente: ferramentas `previa_da_serie_no_extrato`, `lancar_serie_do_extrato`, `consultar_series_no_extrato` e `juntar_linhas_a_serie`, e a regra no prompt.

Motivo: os meses são importados fora de ordem, e a mesma parcela ou recorrente precisa ser reconhecida e lançada junta em todos eles.

Verificação: testes do domínio da série (11), do backend todo (513) e do agents (61) passando. tsc, oxlint e eslint limpos. Pelo BFF local, com um extrato de teste de agosto a novembro (agosto com hífen, setembro com travessão e duas linhas):

- a prévia achou os quatro meses, e como parcela 2/3 ficou com setembro=1, outubro=2 e novembro=3;
- lançar juntas criou a recorrente com início em agosto e as quatro ocorrências pagas (novembro em 105, o valor do extrato), mais a parte de 40 em setembro;
- um mês novo (dezembro) importado depois apareceu no aviso e foi juntado;
- numa recorrente que começou em outubro, agosto e setembro apareceram como "antes" e entraram como únicas;
- o diálogo foi fotografado em 1280 e 375 px, sem rolagem lateral. Tudo de teste foi apagado.

Não feito: o app de celular (Ionic) não ganhou o diálogo.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/extratos/dominio/serie.ts` e `serie.spec.ts` (novos)
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/extratos.controller.ts`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/api/extratos/series/` (`route.ts`, `previa/route.ts`, `[id]/linhas/route.ts`, novos)
- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/frontend/app/extratos/conferencia/serie.tsx` (novo)

## A Conferência compara pelo destino e lembra também as transferências

- Em `nome-extrato.ts`, três funções novas: `palavrasDoDestino` (as palavras da descrição sem as genéricas de extrato, como compra, débito, pix, transferência, enviada, agência, conta e banco, e sem números soltos), `descricoesParecidas` (a chave é igual, ou todas as palavras de destino da mais curta estão na mais longa) e `palavrasEmComum`.
- A série (`serie.ts`) acha a mesma compra por `descricoesParecidas`, e não só pela chave igual.
- Na Conferência, a sessão e os nomes lembrados vêm da mesma chave ou, se não houver, da descrição parecida com mais palavras em comum. Empate entre sessões diferentes não sugere nada.
- Saiu a regra que não lembrava a sessão de transferência para pessoa (`ehTransferenciaDePessoa`), com os testes dela. A transferência grava a associação e a sessão, como a compra.

Causa: a oferta por Pix vinha como "Transferência enviada pelo Pix - NOVA IGREJA BATISTA" em agosto e setembro, e com CNPJ, banco, agência e conta em outubro. As chaves eram diferentes, então a prévia da recorrente não achava os outros meses e o modal não abria. A versão sem CNPJ era tratada como transferência para pessoa, que lembrava só o nome e nunca a sessão.

Motivo: o mesmo destino escrito de jeitos diferentes precisa ser reconhecido, e a sessão de uma transferência também precisa ficar lembrada.

Verificação: testes do backend (514) passando, com casos novos: o mesmo destino com e sem CNPJ, destinos diferentes, descrição só com palavras genéricas e a oferta por Pix achando os três meses. tsc e oxlint limpos. No banco local, com as linhas reais da igreja (agosto, setembro e outubro):

- a prévia como recorrente achou os três meses;
- lançar agosto na sessão da oferta fez setembro e outubro sugerirem a sessão e o nome "Oferta NIB". O teste foi desfeito.

Arquivos:

- `apps/backend/src/extratos/dominio/nome-extrato.ts` e `nome-extrato.spec.ts`
- `apps/backend/src/extratos/dominio/serie.ts` e `serie.spec.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`

## As pendentes da recorrente e da parcela preveem o valor do último mês

- Operação nova `seguirValorDaSerie`, no repositório e no serviço de Finanças, com o evento de outbox `seguir-valor-da-serie` registrado no contrato. Na recorrente e na parcela, as ocorrências ainda pendentes (sem a multa) e o valor do lançamento passam a prever o valor dado. O que já foi pago, cancelado ou estornado fica como está.
- Na série lançada junta pela Conferência (`juntarNaSerie`), antes de cada linha pagar, as pendentes passam a prever o valor dela. Assim a parcela paga uma parcela inteira (sem cair em pagamento parcial nem pedir multa ou próxima), e no fim as pendentes ficam com o valor do último mês.
- Na recorrente cruzada sozinha (`cruzarELiquidar`), quando vale o valor do extrato e ele é diferente do previsto, as pendentes seguintes passam a prever esse valor. Isso não vale na sessão Fixo nem quando a pessoa escolhe manter o valor lançado. A parcela cruzada sozinha continua com as regras de antes (parcial, multa ou próxima).
- O texto do diálogo da série explica a regra.

Motivo: recorrente e parcela podem mudar de valor de um mês para o outro, e o que fica pendente deve seguir o último valor pago.

Verificação: testes do backend (514), tsc e oxlint limpos. Pelo BFF local:

- recorrente lançada junta com 99, 99 e 105: dezembro ficou previsto em 105;
- depois, dezembro foi cruzado sozinho em 120: janeiro e fevereiro ficaram previstos em 120;
- parcela lançada junta com 100, 100 e 110: as três parcelas foram pagas inteiras, sem falha, e as pendentes ficaram em 110. Tudo de teste foi apagado.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/frontend/app/extratos/conferencia/serie.tsx`

## Caixinhas nas contas, com sessão do rendimento e ligação com a meta

O que foi feito:

- Tabela nova `account_boxes` (model `AccountBox`, migração `20261109150000_caixinhas`). A caixinha é um depósito dentro de uma conta; cartão não tem. O nome é único na conta, e ela guarda o saldo inicial, a sessão dela e a meta opcional (uma meta por caixinha).
- Criar a caixinha cria uma sessão de acúmulo no grupo "Caixinhas", que nasce na primeira caixinha, com o nome "<caixinha> · <conta>". Renomear a caixinha renomeia a sessão. Excluir a caixinha remove a sessão se ela nunca recebeu lançamento; com lançamentos, a sessão fica como histórico. A sessão de caixinha não sai por Grupos: a mensagem manda excluir em Contas. Conta com caixinha não pode ser excluída nem virar cartão.
- Movimentos na sessão (`POST caixinhas/:id/movimentos`): rendimento (entrada sem conta, soma na sobra; negativo é perda), aplicação (sai da conta, entra na caixinha) e resgate (o contrário). Na caixinha comum, aplicação e resgate são transferência, fora da sobra. Na caixinha de meta, a aplicação sai da sobra como valor separado para a meta.
- Saldo da caixinha = saldo inicial + aplicações + rendimentos − resgates já pagos até hoje (`resumoDaCaixinha` e `efeitoNaCaixinha` no contrato).
- Metas: a meta ligada soma o saldo da caixinha no guardado (`Meta.box`), e "Separar" e "Aprovar" viram aplicação na caixinha. Na sobra das Metas, aplicação e resgate da caixinha de meta contam como separado; o rendimento segue como entrada do mês. Excluir a meta solta a caixinha. `PUT metas/:id/caixinha` liga ou desliga.
- Tela Contas: seção "Caixinhas desta conta" com saldo, rendimento do mês da tela e total, e os botões Lançar rendimento, Aplicar, Resgatar e Editar (com excluir). O resumo ganhou "Nas caixinhas" e "Conta e caixinhas". Tela Metas: linha "Guarda na caixinha" com diálogo para escolher a caixinha.
- Assistente: ferramentas `criar_caixinha`, `editar_caixinha`, `excluir_caixinha`, `movimentar_caixinha` e `guardar_meta_na_caixinha`; `consultar_contas` lista as caixinhas; regra no prompt dos agentes.
- Exportar, importar e zerar dados incluem as caixinhas. A exportação passou a levar também a sessão e a ordem das metas, que antes se perdiam na importação.
- Operações do outbox: `criar-caixinha`, `atualizar-caixinha`, `excluir-caixinha` e `ligar-meta-a-caixinha`.

Motivo: a pessoa quer registrar os depósitos de cada conta e o quanto renderam no mês, e ligar o dinheiro guardado às metas.

Verificação: testes do backend passando. No ambiente local:

- conta 1.000 − aplicação 300 + resgate 50 − aplicação da meta 100 = 650;
- CDB em 252,50; Reserva da meta em 301,50, e a meta mostrou 301,50 guardado;
- o separado do mês subiu 100, e a sobra subiu só os rendimentos (4,00).

Não feito: o app mobile ainda não mostra caixinhas.

Atenção ao subir: a migração `20261109150000_caixinhas` roda sozinha quando o `backend` sobe.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261109150000_caixinhas/` (novo)
- `apps/backend/src/contas/` (`caixinhas.controller.ts`, `aplicacao/caixinhas.service.ts`, `adaptadores/prisma-caixinhas-repositorio.ts` e `portas/caixinhas-repositorio.ts`, novos; `contas.module.ts`, `contas.service.ts` e spec, `prisma-contas-repositorio.ts`, `contas-repositorio.ts`)
- `apps/backend/src/metas/` (`metas.service.ts` e spec, `metas.controller.ts`, `metas.module.ts`, `prisma-metas-repositorio.ts`)
- `apps/backend/src/exclusoes/` (service, spec e module)
- `apps/backend/src/dados/` (`pacote.ts`, `zerar.ts`, `prisma-dados-repositorio.ts`)
- `apps/backend/src/assistente/` (`rotas-das-ferramentas.ts`, `resultados.ts`)
- `apps/agents/src/assistente/dominio/prompts.ts`
- `packages/contracts/src/index.ts`
- `apps/frontend/app/contas/` (`caixinhas.tsx`, `page.tsx`)
- `apps/frontend/app/metas/` (`caixinha-da-meta.tsx`, `page.tsx`)
- `apps/frontend/app/api/contas/[id]/caixinhas/`, `apps/frontend/app/api/caixinhas/` e `apps/frontend/app/api/metas/[id]/caixinha/`

## Apagar a meta encerra a sessão dela

O que foi feito:

- Apagar uma meta agora sempre encerra a sessão dela no grupo Metas, mesmo quando ela já recebeu valor separado. Antes só a sessão vazia era encerrada; a com lançamentos ficava aberta em Finanças como histórico.
- A rota `DELETE metas/:id` saiu do `MetasController` e foi para o `ExclusoesController`. `ExclusoesService.meta` apaga a meta, solta as linhas de extrato ligadas à sessão, encerra a sessão e esquece as associações, como a exclusão de sessão em Grupos. `MetasService.excluir` agora só apaga a meta e devolve o que apagou.
- O valor separado deixa de contar e volta para a sobra. A caixinha ligada continua na conta, sem a meta.
- O diálogo de exclusão em Metas e a descrição da ferramenta `excluir_meta` da IA dizem isso.

Motivo: a meta apagada continuava aparecendo em Finanças com o valor separado.

Verificação no ambiente local: meta com R$ 300 separados, apagada, saiu de Finanças, e o separado do mês voltou de 20.300 para 20.000. A sessão "Casamento", que tinha ficado aberta de uma meta apagada antes, foi encerrada pela exclusão de sessão.

Atenção ao subir: no Railway, uma sessão que ficou aberta de meta apagada antes desta mudança precisa ser excluída em Grupos.

Arquivos:

- `apps/backend/src/metas/aplicacao/metas.service.ts` e `metas.service.spec.ts`
- `apps/backend/src/metas/metas.controller.ts`
- `apps/backend/src/exclusoes/aplicacao/exclusoes.service.ts` e `exclusoes.service.spec.ts`
- `apps/backend/src/exclusoes/exclusoes.controller.ts`
- `apps/frontend/app/metas/page.tsx`
- `packages/contracts/src/index.ts`
