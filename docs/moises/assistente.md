# Assistente

## O assistente pensa como consultor financeiro

O que foi feito: o assistente passou a interpretar o pedido antes de lançar um valor, em vez de só executar.

- **Modo de consultor:** novo módulo `apps/agents/src/assistente/dominio/consultor.ts` com o jeito de pensar antes de lançar um valor. Entender o que ele é (renda recorrente, eventual ou variável, moradia, conta de consumo, assinatura, fatura de cartão, parcela, empréstimo, imposto, gasto do dia a dia, dinheiro guardado). Completar o que falta com o costume e dizer a suposição em uma frase, em vez de perguntar. Traduzir para o sistema (sessão, categoria, recorrência, regra de vencimento). Medir o efeito no mês com `consultar_mes_financeiro`. Aconselhar em uma frase só quando houver sinal: sobra negativa, fixas acima de metade da renda, conta que vence antes do dinheiro, parcela longa com juros, falta de reserva.
- **Convenções financeiras gerais (Brasil):** salário (CLT até o 5º dia útil, ou dia fixo da empresa; nunca cai em fim de semana ou feriado, então antecipa; quinzena ou adiantamento perto do dia 15 ou 20 mais o restante no fim do mês, como duas entradas fixas), 13º e férias, renda variável, moradia, contas de consumo, assinaturas, cartão de crédito (a saída é a fatura; não contar duas vezes), empréstimo e financiamento, impostos do ano, dinheiro guardado (é meta, não gasto) e o padrão de vencimento da conta. São ponto de partida: o que a pessoa diz vale mais.
- **Especialistas:** Finanças, Organização, Metas e Análise recebem o modo e as convenções; Agenda e Extratos não. A resposta final diz o que foi feito, a suposição e o efeito no mês, em até três frases. Finanças usa `dueRule` também quando a convenção do tipo pede. Análise traz o que o número quer dizer e o que olhar a seguir.
- **Correção:** `consultar_mes_financeiro` devolvia a visão inteira de Finanças, e o modelo tomava o mês de início do workflow (março) como o mês atual. Agora recebe ano e mês e consulta o painel desse mês (contrato em `packages/contracts/src/index.ts` e rota em `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`).
- **Finanças cria o grupo e a sessão ela mesma:** em produção (conversa das 12:10), depois de a pessoa aprovar "criar as duas sessões", Finanças respondeu só em texto, sem `encaminhar` nem criar nada; numa conversa anterior (11:27) o passe de bastão para Organização funcionou. Depender de o modelo passar o pedido de um agente para outro no meio do caso mais comum era frágil. As ferramentas `criar_grupo` e `criar_sessao` agora também valem para Finanças (`packages/contracts/src/index.ts`), e o prompt manda criar na mesma resposta (grupo se faltar, sessão de acúmulo para fixa, parcela ou empréstimo) e lançar em seguida, sem encaminhar para Organização.
- **Regra geral para todos os agentes:** se a pessoa aprovou uma proposta ou escolheu uma opção, fazer agora com as ferramentas; nunca encerrar só anunciando o que vai fazer.

Motivo: o assistente criava os lançamentos sem entender o tipo do valor nem o efeito nas finanças, e a pessoa quer um consultor que interprete o pedido, não só um executor.

Como foi verificado: agents com 24 testes (novos: quem mexe com dinheiro tem o modo e as convenções, e Agenda e Extratos não; Finanças cria sessão e grupo; a regra de não encerrar só anunciando) e backend com 314; tipos limpos; Docker reconstruído. Pergunta real "Como está meu mês? Minhas contas cabem no que eu ganho?": antes da correção respondeu sobre março; depois, consultou outubro e explicou que a sobra negativa vinha das metas, não de contas acima da renda, e que faltava cadastrar a renda. Não verificado: a criação de lançamentos e o fluxo completo de Finanças criando grupo e sessão com o modelo de produção; o modelo local não aceita ferramentas, então o teste real fica para o servidor.

Limites conhecidos: é instrução de prompt, então a qualidade depende do modelo; as convenções cobrem o caso comum e podem não valer para quem tem regras diferentes; o valor das contas de consumo é a média que a pessoa informar.

Arquivos:

- `apps/agents/src/assistente/dominio/consultor.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/agents/src/assistente/dominio/prompts.spec.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`

## O assistente continua rodando quando a pessoa sai da aba

O que foi feito: o servidor já mantinha o turno vivo se a conexão caísse (PR anterior). O que perdia o fio era a tela: ao sair da aba o chat era desmontado, mostrava o aviso falso "Parei. O que já foi feito continua feito." e, voltando pelo menu (sem `?c=` na URL), abria um chat em branco; a conversa que ainda rodava não aparecia como em andamento, e trocar de conversa ficava travado enquanto o assistente trabalhava.

- **Tela:** sair da aba ou abrir outra conversa solta a conexão sem avisar nada e sem parar o servidor (ref `soltou`). Ao voltar sem `?c=`, abre a conversa que o servidor ainda responde; se ela está em andamento, mostra "O assistente continua trabalhando nesta conversa" e acompanha até o resultado. O andamento só aparece na conversa em que o turno roda (estado `turnoEm`). Dá para trocar de conversa e criar nova sem parar o assistente. Enquanto outra conversa trabalha em segundo plano, a lista mostra "Trabalhando" e se atualiza a cada 4 s. Enviar outra mensagem durante um turno mostra um aviso em vez de ignorar.
- **Backend:** a lista de conversas devolve `emAndamento` por conversa (`assistente.service.ts`, tipo `ConversaResumo` no contrato `packages/contracts/src/index.ts`).

Motivo: a pessoa precisa poder mudar de aba ou de conversa sem perder o assistente, que tem de continuar rodando.

Como foi verificado: backend com 315 testes (novo: a lista marca a conversa que ainda responde e desmarca ao fim), tipos e lint limpos, Docker reconstruído. No Chrome, pela interface: enviei uma mensagem que usa ferramenta, saí para Metas no meio e voltei pelo menu sem `?c=`. O servidor terminou o turno sozinho (log `turno do assistente encerrado`, sem `interrompido`), a conversa reabriu com o indicador e a marca "Trabalhando" na lista, e o resultado apareceu no fim, sem toast "Parei" e sem erro de página. Não verificado: trocar de conversa no meio do turno e o comportamento no celular.

Limites conhecidos: ao voltar, a tela mostra o texto que o turno já tem, enquanto o processo segue vivo. Cada passo concluído fica gravado. Se o processo cair no meio de um passo, esse passo se perde; o que já tinha terminado permanece. O turno em andamento continua na memória de uma réplica.

Arquivos:

- `apps/frontend/app/assistente/chat.tsx`
- `apps/frontend/app/assistente/conversas.tsx`
- `apps/backend/src/assistente/aplicacao/assistente.service.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.spec.ts`
- `packages/contracts/src/index.ts`

## Consultor único com plano aprovado

O que foi feito: o assistente virou um agente só, que consulta, pergunta e propõe um plano, e só muda o sistema depois que a pessoa aprova.

- **Um agente só:** o Consultor usa o modelo da função coordenador e tem todas as ferramentas do sistema, mais `perguntar` e `propor_plano`. Saíram a triagem, os especialistas e o `encaminhar`.
- **Ciclo garantido pelo código:** o consultor consulta à vontade, pergunta o que muda o caminho e propõe um plano (objetivo, entendimento, suposições, passos com ferramenta e argumentos). O backend recusa qualquer ferramenta que muda o sistema fora de um plano aprovado.
- **Validação do plano:** o backend confere que a ferramenta existe, que não é consulta e que os argumentos passam no esquema Zod dela. Gera de antemão o id de cada passo que cria algo e troca as referências `@passo:N` por esses ids.
- **Realidade do plano:** antes de mostrar, o sistema calcula as datas reais dos lançamentos (fim de semana, feriado, regra de vencimento ou padrão da conta), a sobra do mês antes e depois, e os alertas: sobra negativa, conta que vence antes da primeira entrada, fixas acima de 50% das entradas.
- **Tela:** o cartão do plano tem Aprovar e executar, Cancelar e um campo para pedir ajuste. Aprovado, o backend executa os passos na ordem e para no primeiro que falhar; os seguintes ficam como não feitos. O ajuste faz o consultor refazer o plano. Conversa antiga parada numa confirmação ("Confirmar") continua funcionando. Os textos da tela vazia e do rodapé agora dizem que o consultor mostra o plano e que nada muda sem aprovação.
- **Configurações, Inteligência artificial, Agentes:** um card só, com as ferramentas que mudam o sistema marcadas "Só com plano aprovado".

Motivo: o assistente parava no meio ao passar o pedido entre agentes e fazia o que supunha sem mostrar o caminho; agora mostra o plano com o efeito real e só muda algo depois da aprovação da pessoa.

Como foi verificado: backend com tsc, lint do assistente e 321 testes passando. Entre eles estão os novos de `fatos-do-plano.spec.ts`: salário do dia 30 que cai num sábado vem na sexta; conta que cai num feriado vai para o dia útil seguinte; alertas de conta antes da entrada, de fixas acima de 50% e de sobra negativa; referências `@passo:N` são trocadas e são recusadas quando apontam para passo que não cria nada. Também estão os novos do orquestrador: escrita fora do plano é recusada; plano aprovado executa em ordem com os ids encadeados; a execução para no primeiro passo que falha; o ajuste refaz o plano. Agents com tsc e 17 testes passando (um nó só, todas as ferramentas mais `perguntar` e `propor_plano`, sem `encaminhar`). Docker reconstruído, com os cinco serviços de pé, sem migração pendente e `localhost:3000` respondendo. O cartão do plano foi conferido na tela em 1440 e 760 px, com uma conversa de exemplo inserida no Postgres local e apagada depois.

Limites conhecidos: o ciclo com um modelo de verdade não foi testado no local, porque o modelo local não chama ferramentas de forma confiável; falta conferir no servidor com o modelo configurado lá. O tema escuro e a largura de 375 px do cartão não foram conferidos. A sobra do plano cobre criar, editar, cancelar e apagar lançamento; meta, compromisso e grupo não entram nesse número. A memória do perfil financeiro fica para depois.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/agents/src/assistente/adaptadores/grafo-do-assistente.ts`
- `apps/agents/src/assistente/adaptadores/grafo-do-assistente.spec.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/agents/src/assistente/dominio/prompts.spec.ts`
- `apps/agents/src/assistente/dominio/consultor.ts`
- `apps/agents/src/assistente/dominio/mensagens.ts`
- `apps/agents/src/assistente/dominio/mensagens.spec.ts`
- `apps/backend/src/assistente/dominio/plano.ts`
- `apps/backend/src/assistente/dominio/fatos-do-plano.ts`
- `apps/backend/src/assistente/dominio/fatos-do-plano.spec.ts`
- `apps/backend/src/assistente/dominio/conversa.ts`
- `apps/backend/src/assistente/portas/realidade-da-conta.ts`
- `apps/backend/src/assistente/portas/conversas-repositorio.ts`
- `apps/backend/src/assistente/adaptadores/realidade-do-sistema.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/backend/src/assistente/adaptadores/executor-http.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.spec.ts`
- `apps/backend/src/assistente/assistente.module.ts`
- `apps/frontend/app/assistente/plano.tsx`
- `apps/frontend/app/assistente/mensagem.tsx`
- `apps/frontend/app/assistente/vazio.tsx`
- `apps/frontend/app/assistente/compositor.tsx`
- `apps/frontend/app/configuracoes/ia/agentes.tsx`

## Regras do extrato no plano

O que foi feito: o consultor recebe as regras da conferência. Única usa o valor do extrato. Fixa, parcela e empréstimo divergentes só entram no plano com a escolha da pessoa, extrato ou lançamento, e o cartão mostra os dois valores e qual vale no mês. Extra só cruza com entrada. Acumular cria única e não serve para uma série que já existe. A conferência que o consultor lê vem em páginas de 10 linhas sem lançamento. A sobra do plano troca o valor planejado pelo valor escolhido.

Motivo: lançar a linha como única e deixar o modelo escolher o valor sozinho não trata fixa, parcela, empréstimo e extra.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/agents/src/assistente/dominio/prompts.spec.ts`
- `apps/backend/src/extratos/dominio/cruzar.ts`
- `apps/backend/src/extratos/dominio/cruzar.spec.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/extratos.controller.ts`
- `apps/backend/src/assistente/dominio/fatos-do-plano.ts`
- `apps/backend/src/assistente/dominio/fatos-do-plano.spec.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.ts`
- `apps/backend/src/assistente/portas/realidade-da-conta.ts`
- `apps/backend/src/assistente/adaptadores/realidade-do-sistema.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/frontend/app/assistente/plano.tsx`

## Sobra do plano e texto do turno

O que foi feito: a sobra do plano passou a contar criar, editar, cancelar e apagar lançamento. Enquanto o turno segue, a conversa devolve o texto que o processo já escreveu e cada passo concluído fica gravado; a tela mostra esse texto sem esperar o fim. Em Configurações, o interruptor de confirmar antes de apagar saiu: criar, editar, apagar e cancelar só acontecem depois do plano aprovado.

Motivo: a sobra só somava lançamento novo, ao voltar a tela não mostrava o texto já escrito, e a confirmação de apagar ainda era um interruptor à parte do plano.

Arquivos:

- `apps/backend/src/assistente/dominio/fatos-do-plano.ts`
- `apps/backend/src/assistente/dominio/fatos-do-plano.spec.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.spec.ts`
- `apps/frontend/app/assistente/chat.tsx`
- `apps/frontend/app/configuracoes/ia/comportamento.tsx`
