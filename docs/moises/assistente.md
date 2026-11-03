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

## Consultor que narra o plano em vez de propô-lo

O que foi feito: quando o consultor termina o turno só com texto e esse texto promete uma mudança ("vou criar", "preciso propor o plano", "proponho"; texto que termina em "?" não conta), ou quando o backend acabou de recusar uma escrita fora do plano, o grafo repete a volta uma vez com `tool_choice` em `propor_plano`, levando o texto dele e um aviso do sistema (que não entra no histórico). O texto fica e o plano vem logo depois. Se a segunda volta não propõe ou falha no provedor, a resposta de texto original é mantida e há log. A mensagem de recusa virou a constante `RECUSA_DE_ESCRITA_FORA_DO_PLANO` nos contratos, usada pelo backend ao recusar e pelo agents para reconhecê-la. O prompt ganhou a frase que proíbe dizer em texto que vai propor sem chamar `propor_plano` na mesma resposta.

Motivo: nos logs de produção (03/11/2026) alguns turnos respondiam "Posso organizar isso, mas preciso propor o plano antes de mudar. Vou criar..." sem chamar a ferramenta; o grafo tratava texto sem chamada como fim do turno, o histórico voltava ao modelo e ele repetia a resposta, sem erro, lentidão ou limite do provedor.

Verificação: `anuncio.spec.ts` (promessa real de produção, variações, conversa e pergunta que não disparam) e 6 casos novos em `grafo-do-assistente.spec.ts`; agents com 30 testes, backend com 352, `tsc` dos três apps limpo. Não verificado: o comportamento com o modelo real (só modelo falso em teste) e o Docker não foi reconstruído (rede do container ao npm). A correção só vale em produção depois do deploy de agents e backend.

Sugestão não feita: em Configurações, Inteligência artificial, Agentes, todas as funções usam `gpt-5.4-mini`; testar um modelo maior para o coordenador reduz o problema pela raiz, ao custo de preço por turno.

Arquivos:

- `apps/agents/src/assistente/dominio/anuncio.ts`
- `apps/agents/src/assistente/dominio/anuncio.spec.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/agents/src/assistente/adaptadores/grafo-do-assistente.ts`
- `apps/agents/src/assistente/adaptadores/grafo-do-assistente.spec.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.ts`
- `packages/contracts/src/index.ts`

## Lançar a conferência inteira e contar o que sobrou

O que foi feito: `acumularVarias` passou a devolver também `remaining`, uma lista `{ year, month, lines }` com as linhas que ainda ficaram sem lançamento em cada mês que o lote tocou (mesmo número da conferência; linha que falha ou não existe não derruba o lote nem inventa mês). No prompt do consultor, o passo 1 manda ler todas as páginas da conferência antes de propor quando o pedido é sobre a conferência toda: a primeira página traz o total `pending` e o tamanho da página, e as demais são pedidas juntas, na mesma resposta, chamando `consultar_conferencia` várias vezes; nunca propor só com a primeira. O passo 5 manda olhar `remaining` depois de lançar, dizer quantas ficaram e por quê (`failed`), propor outro plano para o que sobrou e só dizer que terminou quando não sobrou nenhuma.

Motivo: nos logs de produção (03/11/2026) o plano aprovado rodou `acumular_linhas` (58 s) e o consultor só chamou `consultar_mes_financeiro` e respondeu, deixando linhas sem lançamento; o passo 5 conferia só o mês, a conferência devolve 10 linhas por página e o consultor tem `maxPassos` 8 por turno, então ler tudo e ainda planejar estoura, e o resultado do lote era só `{ launched, failed }`. O log não guarda o conteúdo das mensagens e a leitura do banco de produção foi negada, então a causa exata dessa conversa é inferência.

Verificação: `extratos.service.lote.spec.ts` (novo, 3 casos: `remaining` por mês, linha que falha, linha inexistente) e um caso novo em `prompts.spec.ts`; backend e agents passam, `tsc` limpo. Não verificado: o comportamento com o modelo real (só testes e o código) e o Docker não foi reconstruído (rede do container ao npm). A correção só vale em produção depois do deploy de agents e backend. As linhas que já sobraram precisam ser pedidas de novo ao assistente ou lançadas na Conferência.

Sugestão não feita: subir `maxPassos` para 12 em Configurações, Inteligência artificial, Comportamento, para contas com conferência grande.

Arquivos:

- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.lote.spec.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/agents/src/assistente/dominio/prompts.spec.ts`

## Auditoria do agente: narrar em vez de agir, plano grande e conferência lenta

O que foi feito, a partir dos logs de produção do Railway (03/11/2026, conversa de lançar as linhas de Uber e 99 da conferência):

- Narrar em vez de agir: um passo de 2,2 s terminou só com texto ("Vou revisar a conferência inteira... e te digo exatamente o que sobrou"), sem ferramenta. `dominio/anuncio.ts` ganhou mais verbos de promessa (revisar, conferir, verificar, dividir, refazer, mostrar...), as formas "te mostro/digo", "em seguida" e "próximo passo" (saiu "posso", para não pegar oferta), `recusouPlano` e `escolhaDaSegundaChance` (`propor_plano` depois de recusa ou quando o texto fala do plano; qualquer ferramenta, `any`, quando a promessa é de consultar). No grafo, a segunda volta passou a valer para promessa em qualquer assunto e para qualquer recusa do backend (escrita fora do plano ou plano recusado): obriga a ferramenta escolhida, mantém o texto e devolve as chamadas; se falhar, mantém a resposta original. O prompt ganhou a regra de que cada resposta ou chama ferramenta ou é a resposta final.
- Plano com mais de 20 passos: o consultor leu 3 páginas da conferência, chamou `propor_plano` com mais de 20 passos, o backend recusou ("Plano inválido: passos: Too big: expected array to have <=20 items") e a volta seguinte respondeu "Vou dividir em blocos e te mostrar o próximo passo", encerrando o turno sem plano. Em `packages/contracts` entraram `PASSOS_MAXIMOS_DO_PLANO` (20, usado no esquema), `RECUSA_DE_PLANO` (o fim do resultado do plano recusado) e o limite na descrição do `propor_plano`. `plano.ts` devolve a mensagem `mensagemDoPlanoGrande`, que manda juntar as linhas únicas em `acumular_linhas`; `assistente.service.ts` usa `RECUSA_DE_PLANO` nas duas recusas. O prompt passou a dizer o limite de 20 passos, que várias linhas únicas vão em um passo só (`acumular_linhas`, até 500 linhas) e que plano recusado se corrige na mesma resposta.
- Conferência lenta: ela só era lida em páginas de 10, sem busca por nome. `consultar_conferencia` ganhou o parâmetro `busca` (nomes separados por `|`). Novo `extratos/dominio/busca.ts` (`termosDaBusca`, `casaComABusca`: sem acento, sem diferenciar caixa, termo de menos de 2 letras descartado, no máximo 8 termos). `extratos.service.ts` e `extratos.controller.ts` aceitam a busca junto com `pagina`: `page.total` passa a ser quantas casam, `pending` continua sendo o total sem lançamento do mês, e busca inválida responde com mensagem própria. `rotas-das-ferramentas.ts` repassa a busca. O prompt explica o uso.

Motivo: nada no prompt dizia o limite do plano nem que linhas únicas cabem em um passo, a recusa voltava com o erro cru do esquema, a correção anterior só tratava escrita fora do plano com lista fixa de verbos, e a conferência não tinha busca. Essa conversa já rodava as correções anteriores (os deploys do backend e do `agents` foram às 15:31 UTC e os turnos com falha são de 15:34 e 15:35), então o que falhou foi o que elas não cobriam: a lista fixa de verbos e a recusa do plano. O log não guarda o conteúdo das mensagens, então o desenho vem dos logs e do código.

Verificação: `anuncio.spec.ts` ampliado com os dois textos reais da conversa e os que não podem disparar; 2 casos novos no grafo (promessa de consultar obriga `any`; plano recusado obriga `propor_plano`); `plano.limite.spec.ts` e `busca.spec.ts` novos; backend com 368 testes e agents com 39 passam; `tsc` dos três apps limpo. Ao vivo, na rota real da conferência (backend de teste fora do Docker contra o Postgres do Compose): sem busca, 6 linhas; busca `shell|mercado` traz 2 linhas com `pending` 6 e `page.total` 2; busca sem resultado volta vazia. Não verificado: o comportamento com o modelo real, e o Docker não foi reconstruído (rede do container ao npm). A correção só vale em produção depois do deploy de agents e backend.

Pendências sugeridas, sem código:

- Todas as funções usam `gpt-5.4-mini`; testar um modelo maior para o coordenador.
- O histórico inteiro volta ao modelo a cada turno: conversa longa pesa e uma resposta travada vira exemplo para as seguintes. Aparar o histórico é uma melhoria futura.
- `maxPassos` está em 8 por turno em Configurações, Inteligência artificial, Comportamento; pode subir a 12.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/assistente/dominio/plano.ts`
- `apps/backend/src/assistente/dominio/plano.limite.spec.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/backend/src/extratos/dominio/busca.ts`
- `apps/backend/src/extratos/dominio/busca.spec.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/extratos.controller.ts`
- `apps/agents/src/assistente/dominio/anuncio.ts`
- `apps/agents/src/assistente/dominio/anuncio.spec.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/agents/src/assistente/adaptadores/grafo-do-assistente.ts`
- `apps/agents/src/assistente/adaptadores/grafo-do-assistente.spec.ts`

## Lançar selecionadas em blocos na Conferência

O que foi feito: "Lançar selecionadas" e "Lançar alteradas" na Conferência passaram a mandar as linhas em pedidos de 8, somando lançadas e falhas. Um bloco que falha por rede marca só as linhas dele como não lançadas.

Motivo: o lote inteiro ia num único `POST /extratos/acumular-lote` que passava de 60 s em produção (backend em EU West, banco no Supabase `us-east-1`) e o BFF respondia 504, embora o backend terminasse o trabalho.

Verificação: `tsc` do frontend limpo. Não verificado na tela nem em produção; vale só depois do deploy do `frontend`. O assistente (`acumular_linhas`) tem o mesmo limite de tempo e segue sem mudança.

Arquivos:

- `apps/frontend/app/extratos/conferencia/page.tsx`
