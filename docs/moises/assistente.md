# Assistente

## O assistente pensa como consultor financeiro

O que foi feito: o assistente passou a interpretar o pedido antes de lançar um valor, em vez de só executar.

- **Modo de consultor:** novo módulo `apps/agents/src/assistente/dominio/consultor.ts` com o jeito de pensar antes de lançar um valor. Entender o que ele é (renda recorrente, eventual ou variável, moradia, conta de consumo, assinatura, fatura de cartão, parcela, empréstimo, imposto, gasto do dia a dia, dinheiro guardado). Completar o que falta com o costume e dizer a suposição em uma frase, em vez de perguntar. Traduzir para o sistema (sessão, categoria, recorrência, regra de vencimento). Medir o efeito no mês com `consultar_mes_financeiro`. Aconselhar em uma frase só quando houver sinal: sobra negativa, fixas acima de metade da renda, conta que vence antes do dinheiro, parcela longa com juros, falta de reserva.
- **Convenções financeiras gerais (Brasil):** salário (CLT até o 5º dia útil, ou dia fixo da empresa; nunca cai em fim de semana ou feriado, então antecipa; quinzena ou adiantamento perto do dia 15 ou 20 mais o restante no fim do mês, como duas entradas fixas), 13º e férias, renda variável, moradia, contas de consumo, assinaturas, cartão de crédito (a saída é a fatura; não contar duas vezes), empréstimo e financiamento, impostos do ano, dinheiro guardado (é meta, não gasto) e o padrão de vencimento da conta. São ponto de partida: o que a pessoa diz vale mais.
- **Especialistas:** Finanças, Organização, Metas e Análise recebem o modo e as convenções; Agenda e Extratos não. A resposta final diz o que foi feito, a suposição e o efeito no mês, em até três frases. Finanças usa `dueRule` também quando a convenção do tipo pede. Análise traz o que o número quer dizer e o que olhar a seguir.
- **Correção:** `consultar_mes_financeiro` devolvia a visão inteira de Finanças, e o modelo tomava o mês de início do workflow (março) como o mês atual. Agora recebe ano e mês e consulta o painel desse mês (contrato em `packages/contracts/src/index.ts` e rota em `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`).

Motivo: o assistente criava os lançamentos sem entender o tipo do valor nem o efeito nas finanças, e a pessoa quer um consultor que interprete o pedido, não só um executor.

Como foi verificado: agents com 23 testes (novo: quem mexe com dinheiro tem o modo e as convenções; Agenda e Extratos não) e backend com 314; tipos limpos; Docker reconstruído. Pergunta real "Como está meu mês? Minhas contas cabem no que eu ganho?": antes da correção respondeu sobre março; depois, consultou outubro e explicou que a sobra negativa vinha das metas, não de contas acima da renda, e que faltava cadastrar a renda. Não verificado: a criação de lançamentos com o modelo de produção depois da mudança.

Limites conhecidos: é instrução de prompt, então a qualidade depende do modelo; as convenções cobrem o caso comum e podem não valer para quem tem regras diferentes; o valor das contas de consumo é a média que a pessoa informar.

Arquivos:

- `apps/agents/src/assistente/dominio/consultor.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/agents/src/assistente/dominio/prompts.spec.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
