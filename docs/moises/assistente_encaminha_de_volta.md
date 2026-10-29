# Assistente: devolve o pedido e guia a organização financeira

## A Organização devolve o pedido para Finanças e o assistente passa a conduzir a organização do financeiro

O que foi feito: no assistente, o agente de Organização passou a devolver o pedido para Finanças depois de criar grupo e sessões, em vez de encerrar o turno com um resumo. A mudança está no prompt (`apps/agents/src/assistente/dominio/prompts.ts`).

- **Regra comum:** "ao terminar, diga o que foi feito" ganhou a exceção "se ainda resta parte do pedido que é de outro especialista, a última ação é encaminhar, sem resumo".
- **Organização:** quando as notas dizem que Finanças passou o pedido, a última ação é encaminhar de volta para Finanças, dizendo o que falta lançar (valor, dia, regra de vencimento e nome de cada sessão). Só termina com texto depois que o valor estiver lançado.
- **Teste:** `prompts.spec.ts` exige essas frases.
- **Propósito do assistente:** todos os agentes passam a saber que o propósito é ajudar a pessoa a organizar o financeiro no Prumo, usando as funções do sistema, na ordem: grupos e sessões, lançamentos (dia e regra de vencimento), sobra do mês e metas (prioridade na sobra, divisão por porcentagem). Com a conta vazia ou pedido de ajuda para começar, conduz em poucas perguntas por vez (o que recebe e quando, o que paga todo mês, quais metas) e cria o que falta. "Você propõe; a pessoa decide." A triagem manda "começar/organizar o financeiro" para Finanças; a conversa sem ferramentas oferece ajuda para organizar o financeiro ao cumprimento.
- **Ferramentas novas de Metas** (contrato em `packages/contracts/src/index.ts`, rotas em `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`): `dividir_sobra_das_metas` (propõe a divisão em porcentagem; nada é separado até a pessoa aprovar na tela de Metas), `organizar_prioridade_das_metas` e `separar_valor_da_meta`. `consultar_metas` agora descreve ordem de prioridade, quanto cada meta pede da sobra e a divisão escolhida. O assistente não tem ferramenta de aprovar: aprovar é só da pessoa.
- **Confirmação obrigatória para dinheiro:** nova marca `exigeConfirmacao` nas ferramentas. `separar_valor_da_meta` sempre pede confirmação ("Separar R$ 300,00 para a meta Viagem?"), mesmo com a confirmação de exclusão desligada nas configurações (`assistente.service.ts` e `dominio/conversa.ts`). Dividir a sobra e organizar a prioridade só propõem e não pedem.
- **Executor:** as rotas das ferramentas passam a aceitar `PUT`.

Motivo: em produção, num pedido de salário com duas fontes, a Organização criou o grupo e as duas sessões e parou, e Finanças nunca lançou os dois valores. Os logs novos mostraram o último passo como `resultado="resposta"`, sem `encaminhar`; a causa mais provável é o conflito entre a regra de encaminhar e a de resumir ao terminar. O propósito e as ferramentas de Metas dão ao assistente o caminho completo de organizar o financeiro, sem dinheiro movido sem confirmação.

Como foi verificado: backend com 51 arquivos e 314 testes, agents com 22; tipos limpos. Docker reconstruído e conferido com uma mensagem real ("quero organizar meu financeiro mas não sei por onde começar"): a triagem foi para Finanças, que fez a pergunta guiada com as opções "Cadastrar minha renda / Cadastrar contas fixas / Definir metas", sem criar nada. Não verificado: as ferramentas novas de Metas e o encaminhamento de volta com o modelo real; falta testar no servidor e conferir nos logs do Railway se aparece `encaminhar` de volta para `financas` e a criação dos lançamentos.

Limites conhecidos: é instrução de prompt, então um modelo fraco pode seguir ignorando; a causa foi inferida pelo log, porque o texto final da conversa não foi lido.

Arquivos:

- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/agents/src/assistente/dominio/prompts.spec.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.spec.ts`
- `apps/backend/src/assistente/dominio/conversa.ts`
