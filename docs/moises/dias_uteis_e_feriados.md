# Dias úteis e feriados

## Regra de vencimento com dia útil, ajuste de fim de semana e feriados da conta

O que foi feito: lançamento fixo, parcela e empréstimo ganharam uma regra de vencimento. Única e extra não têm. A conta passou a ter feriados, padrões por categoria e vencimentos no dia real da agenda.

- **Tipos de regra:** "Dia N" (o dia da data do lançamento), "Nº dia útil" (1º a 23º) e "Último dia útil". No "Dia N", o ajuste quando cai em fim de semana ou feriado é manter, antecipar, adiar ou adiar sem passar para o mês seguinte (se adiar trocar o mês, antecipa).
- **Contagem do dia útil:** bancária (segunda a sexta, sem feriado nem Carnaval e Corpus Christi) ou CLT (o sábado conta; domingo e feriado não). A CLT só entra quando a pessoa escolhe e só vale no "Nº dia útil". Se a data CLT cair num sábado, o crédito vai para o dia útil bancário anterior.
- **Fixa semanal e a cada N dias:** não aceitam "Nº dia útil". Só o ajuste do dia.
- **Padrões por categoria:** em Configurações, Finanças, Vencimentos, para fixa de entrada, fixa de saída, parcela e empréstimo. Iniciais: entrada antecipa; saída, parcela e empréstimo adiam. Valem para lançamento novo sem regra escolhida, inclusive os criados pelo assistente de IA. Mudar o padrão não altera o que já foi lançado. Cada linha mostra um exemplo com o próximo dia em que os bancos fecham e para onde o vencimento iria.
- **Formulário de lançamento:** bloco "Vencimento" com os três tipos, o ajuste, o Nº e a contagem. Selo "Padrão" ou botão "Usar o padrão". Prévia animada das próximas datas, já com os feriados da conta, dizendo em que dia cairia e se muda de mês. A prévia da fixa para em dezembro do ano em que começa, como a grade gravada.
- **Feriados:** nacionais fixos (com a Consciência Negra desde 2024); móveis pela Páscoa (Carnaval e Corpus Christi como ponto facultativo com bancos fechados, Quarta-feira de Cinzas como facultativo, Sexta-feira Santa nacional); e locais cadastrados pela conta (dia e mês, repetem todo ano, até 40, um por dia).
- **Configurações, Finanças, Feriados:** chaves "Mostrar feriados na agenda" e "Mostrar pontos facultativos", cadastro dos feriados da cidade e a lista do ano com o tipo, navegando entre anos. Finanças virou grupo na árvore (Geral, Vencimentos, Feriados). No celular, o botão da árvore passou a mostrar o nome de qualquer seção, inclusive as de IA, que antes caíam em "Conta".
- **Feriados na agenda:** o nome do feriado aparece no dia da grade (no celular, o número do dia fica sublinhado), como selo no título do dia na lista e no diálogo do dia. A lista mostra também o dia que só tem feriado.
- **Vencimentos na agenda:** cada vencimento aparece no dia real, já com a regra. Quando o ajuste joga um vencimento para o mês seguinte, ele sai do mês de origem, e o mês que recebe mostra os dois dias, cada um com o seu valor. A fixa semanal aparece uma vez por semana. O vínculo de compromisso continua mostrando o valor do mês do lançamento.
- **Datas já gravadas:** mudar a regra na edição redata só as ocorrências pendentes; pagas, canceladas e estornadas ficam. Adicionar ou remover feriado local redata as pendentes de quem tem regra. Lançamento antigo, sem ocorrências gravadas, ganha a grade gravada já com o calendário da conta.
- **Exportar e importar dados:** levam as regras, os padrões, as preferências de feriado e os feriados locais.

Como funciona:

- **contracts** (`packages/contracts`): calendário de dias úteis, feriados do ano, cálculo da data pela regra, normalização da regra, padrões e a prévia das próximas datas. Backend e tela usam a mesma conta.
- **backend:** nova fatia `feriados` (porta, adaptador Prisma, serviço e rotas `GET /feriados?year=`, `POST /feriados` e `DELETE /feriados/:id`). O módulo núcleo de feriados é importado por finanças e agenda; o módulo HTTP importa finanças, para não fechar ciclo. O POST e o DELETE devolvem quantos lançamentos tiveram datas ajustadas.
- **frontend (BFF):** rotas `/api/feriados` e `/api/feriados/[id]`.
- **banco:** migration `20261029120000_dias_uteis_e_feriados`. `Entry` ganhou `due_rule`, `due_order`, `due_shift` e `due_count`, com CHECK. `preferences` ganhou `due_defaults`, `show_holidays` e `show_optional_holidays`. Nova tabela `holidays`, com índice único por tenant, mês e dia. Lançamentos existentes ficam com "Dia N, manter a data", sem mudança.
- **outbox,** na mesma transação: `criar-feriado-local`, `remover-feriado-local` e `redatar-vencimentos`, com ids e datas, sem dado sensível.
- **agenda:** recebe `holidays` do mês, filtrados pelas preferências. A lista de lançamentos do mês ganhou o campo `number` (a ocorrência). A função saiu do serviço para `agenda/dominio/lancamentos-do-mes.ts`.
- **assistente de IA:** a ferramenta de lançamento aceita `dueRule`, e o prompt de finanças explica quando usar.

Motivo: salário e contas vencem "todo dia 30" ou no "5º dia útil", e a data precisa respeitar fim de semana e feriado, com a pessoa escolhendo o padrão.

Como foi verificado: testes do backend com 45 arquivos e 272 testes passando, incluindo calendário, regra, prévia, padrões, feriados locais e a distribuição dos vencimentos na agenda. Agents com 17 testes passando. TypeScript limpo em contracts, backend, frontend e agents. De ponta a ponta, com Postgres descartável e pelo BFF: salário no 5º dia útil CLT (06/10, 06/11 e 04/12 de 2026); aluguel sem regra pegando o padrão "adiar" (31/10 vai a 03/11 por causa de Finados) e saindo da agenda de outubro; edição só da regra; feriado local em 30/11 redatando as pendentes; feriado repetido recusado (409) e dia inexistente recusado (400); agenda de novembro com os feriados e as preferências ligando e desligando; ocorrência paga mantida ao trocar a regra; remoção do feriado voltando as datas. Capturas de tela da agenda, do formulário e das configurações em 375, 760 e 1440 px, claro e escuro, sem rolagem horizontal. Docker local reconstruído: a migration entrou no log do backend e `localhost:3000` respondeu.

Limites conhecidos: feriados estaduais e municipais não vêm prontos, a conta cadastra os seus; a prévia do formulário usa os padrões e feriados carregados ao abrir o diálogo; a lista de lançamentos da agenda continua usando a descrição do lançamento como título, como antes.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261029120000_dias_uteis_e_feriados`
- `apps/backend/src/feriados`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/financas/financas.controller.ts`
- `apps/backend/src/financas/financas.module.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `apps/backend/src/financas/dominio/pedido.ts`
- `apps/backend/src/agenda/agenda.module.ts`
- `apps/backend/src/agenda/aplicacao/agenda.service.ts`
- `apps/backend/src/agenda/dominio/lancamentos-do-mes.ts`
- `apps/backend/src/configuracoes/dominio/pedido.ts`
- `apps/backend/src/configuracoes/adaptadores/prisma-configuracoes-repositorio.ts`
- `apps/backend/src/dados/dominio/pacote.ts`
- `apps/backend/src/dados/adaptadores/prisma-dados-repositorio.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/api/feriados`
- `apps/frontend/app/agenda/feriados.tsx`
- `apps/frontend/app/agenda/grade.tsx`
- `apps/frontend/app/agenda/lista.tsx`
- `apps/frontend/app/agenda/itens.ts`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/financas/regra-do-vencimento.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/configuracoes/feriados.tsx`
- `apps/frontend/app/configuracoes/painel.tsx`
- `apps/backend/src/financas/dominio/vencimento.spec.ts`
- `apps/backend/src/financas/aplicacao/regra-de-vencimento.spec.ts`
- `apps/backend/src/financas/dominio/pedido.spec.ts`
- `apps/backend/src/feriados/aplicacao/feriados.service.spec.ts`
- `apps/backend/src/configuracoes/dominio/pedido.spec.ts`
- `apps/backend/src/agenda/dominio/lancamentos-do-mes.spec.ts`

## Botão Atualizar em Finanças

O que foi feito: botão "Atualizar" no cabeçalho de Finanças, entre o seletor Base/Geral e "Novo lançamento". Ele recarrega os dados da tela: refaz `/api/financas` e incrementa a `versao`, então as visões Geral e Base recarregam. Enquanto carrega, mostra o ponto de espera e "Atualizando"; ao terminar, mostra o toast "Finanças atualizadas.". O botão é `default`, com o ícone novo `refresh` no componente `Icone`.

Motivo: um lançamento criado em outra aba, como o do assistente de IA, não aparecia até recarregar a página.

Como foi verificado: TypeScript e ESLint limpos nos dois arquivos. Docker local reconstruído. Capturas de tela em 1440 px claro e 375 px escuro, sem rolagem horizontal.

Arquivos:

- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/components/ui/icone.tsx`

## Assistente: todo valor fica numa sessão

O que foi feito: o assistente passou a tratar todo valor em dinheiro como lançamento numa sessão, inclusive salário, conta, aluguel, parcela e mensalidade, que em finanças são do tipo compromisso. Compromisso da agenda não guarda valor; pedido só de compromisso, sem valor, não precisa de sessão.

- **Escolha da sessão:** finanças escolhe a sessão pelo grupo e pelo nome que combinam com o valor. Se nenhuma combina, ou se mais de uma serve, pergunta qual usar, com a opção de criar uma nova. Não lança numa sessão sem relação só porque é a única.
- **Sessão nova:** se a pessoa escolhe criar, finanças encaminha para organização, que cria o grupo se faltar, usa sessão de acúmulo para fixa, parcela e empréstimo e devolve para finanças lançar.
- **Triagem e agenda:** a triagem manda valor a lançar para finanças mesmo quando a pessoa fala em compromisso ou lembrete. A agenda, se receber um valor ainda não lançado, cria o compromisso e encaminha o valor para finanças, que lança e liga os dois com `associar_compromisso`.
- **Descrições das ferramentas no contrato:** `sessionId` do lançamento pede a sessão que combina e manda perguntar se nenhuma combinar; `sessionId` do compromisso explica que é a sessão de acúmulo dos gastos do dia, não o valor; `kind` da sessão diz que "valor" só aceita lançamento único e "acumulo" aceita fixa, parcela e empréstimo.

Motivo: o assistente lançou o salário e a quinzena na sessão "Transporte · Mercado", a única existente, sem perguntar.

Como foi verificado: teste novo `prompts.spec.ts`, com 4 testes. Agents com 21 testes e backend com 272 testes passando. TypeScript limpo em agents, backend e frontend. Docker local reconstruído, sem migration pendente, e `localhost:3000` respondeu. O comportamento com o modelo real ainda não foi exercitado: fica para a pessoa testar no assistente.

Arquivos:

- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/agents/src/assistente/dominio/prompts.spec.ts`
- `packages/contracts/src/index.ts`
