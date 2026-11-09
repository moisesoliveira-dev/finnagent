# Contas

## Partir de hoje: saldo inicial com data, ajuste de saldo e patrimônio

A pessoa quer começar a usar o sistema hoje com o saldo atual do banco e o que já tem guardado, e importar os extratos antigos depois, sem o saldo dobrar.

O que foi feito:

- Conta e caixinha ganharam a data do saldo inicial (`openingOn`, colunas `opening_on`, migração `20261109170000_saldo_inicial_com_data`). Só o que acontece a partir dessa data conta no saldo; o que é anterior aparece na lista do mês marcado "Antes do saldo inicial" e não muda o saldo. Sem data (contas criadas antes), tudo conta. Na criação sem data informada, a data é hoje. `contaNoSaldo`, `resumoDaConta` e `resumoDaCaixinha`, em contracts, respeitam a data.
- `movimentosDoMes` saiu da página web e do mobile e foi para contracts, com o campo `foraDoSaldo`. Web e mobile usam o mesmo.
- Ajuste de saldo: `POST contas/:id/ajuste` com `{ saldoCents, date, foraDaSobra }`. A diferença entre o saldo informado e o calculado vira um lançamento único pago, ligado à conta, na sessão "Ajustes de saldo" do grupo "Ajustes" (os dois nascem no primeiro ajuste). Por padrão conta na sobra; `foraDaSobra` marca como transferência. Diferença zero não lança nada. Na tela de Contas, o botão "Conferir saldo" (no cartão, "Conferir fatura", que grava o valor em negativo) abre o diálogo de `conferir-saldo.tsx`.
- Caixinha: "Informar saldo" (`POST caixinhas/:id/saldo` com `{ saldoCents, date }`). A diferença para o saldo calculado vira rendimento ou perda na data. Serve para cripto, fundo e poupança, em que a pessoa sabe o saldo e não o rendimento.
- Linha de extrato cruzada com um lançamento sem conta: o lançamento passa a ser da conta do extrato (`definirConta`, operação de outbox `definir-conta`). Antes só a linha que criava lançamento novo recebia a conta, e o saldo ficava menor que o do banco. Vale também para a parte de linha dividida que paga uma sessão Fixo.
- Patrimônio na tela de Contas (`patrimonio.tsx`): contas + caixinhas − cartões, hoje, e a evolução dos últimos seis meses em barras (`patrimonio` e `evolucaoDoPatrimonio` em contracts).
- Workflow: deixa de nascer fixo em 2026-03-01; nasce no primeiro dia do mês do primeiro uso (`garantirWorkflow(tenantId, hoje)`). Importar um extrato cujo início é anterior ao início do workflow recua o início para o primeiro dia daquele mês (`recuarInicioDoWorkflow`), para a sobra e as colunas do ano enxergarem o mês importado. `WORKFLOW_INICIAL` continua só como fallback e nos testes.
- Assistente: `criar_conta`, `editar_conta`, `criar_caixinha` e `editar_caixinha` aceitam `openingOn`; ferramentas novas `ajustar_saldo_da_conta` (com confirmação) e `informar_saldo_da_caixinha`; `consultar_contas` mostra a data; regra no prompt.
- Exportar e importar dados levam a data.
- O botão "Nova conta" deixou de ser amarelo: o botão principal da tela passou a ser "Conferir saldo".

Motivo: começar pelo saldo de hoje e importar o passado depois, sem contar duas vezes.

Verificação: no ambiente local, por sonda na API, conta com saldo 1.000 em 09/11 e lançamento de −400 em outubro deu saldo 950 (só o de novembro contou), com outubro listado fora do saldo; ajuste para 1.200 criou lançamento de +250 na sessão Ajustes de saldo, e o ajuste repetido não lançou nada; caixinha com 500 e saldo informado 480 lançou perda de 20; lançamento sem conta cruzado com linha do extrato ganhou a conta; extrato de fevereiro de 2026 recuou o workflow do tenant de março para fevereiro (devolvido depois). Testes do backend (521), tsc e lint limpos; telas conferidas em 375 e 1280 px.

Não feito (lotes seguintes): cartão com fechamento, vencimento, limite e pagar fatura; transferência em par entre contas; começo guiado e caixinhas e patrimônio no mobile.

Atenção ao subir: a migração roda sozinha quando o `backend` sobe. Contas existentes ficam sem data (tudo conta), como antes; a pessoa pode pôr a data em Editar. Tenants já existentes mantêm o workflow que têm.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261109170000_saldo_inicial_com_data/` (novo)
- `packages/contracts/src/index.ts`
- `apps/backend/src/contas/` (`contas.controller.ts`, `caixinhas.controller.ts`, `aplicacao/contas.service.ts` e spec, `aplicacao/caixinhas.service.ts`, `adaptadores/prisma-contas-repositorio.ts`, `adaptadores/prisma-caixinhas-repositorio.ts`)
- `apps/backend/src/financas/` (`portas/financas-repositorio.ts`, `adaptadores/prisma-financas-repositorio.ts`, `aplicacao/financas.service.ts`)
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/dados/dominio/pacote.ts`
- `apps/backend/src/assistente/` (`adaptadores/rotas-das-ferramentas.ts`, `dominio/resultados.ts`)
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/contas/` (`page.tsx`, `dialogo.tsx`, `caixinhas.tsx`, `conferir-saldo.tsx` e `patrimonio.tsx`, novos)
- `apps/frontend/app/api/contas/[id]/ajuste/route.ts` (novo)
- `apps/frontend/app/api/caixinhas/[id]/saldo/route.ts` (novo)
- `apps/mobile/src/paginas/contas/movimentos.ts` e `movimentos.spec.ts`

## Cartão de verdade: fechamento, vencimento, limite, fatura por ciclo e pagar fatura

O cartão era só um rótulo de conta: não tinha ciclo, limite nem fatura, e o pagamento da fatura lançado no banco contava a compra duas vezes.

O que foi feito:

- Conta ganhou `closingDay`, `dueDay` e `limitCents` (só o cartão; conta comum grava null), na migração `20261109190000_cartao_com_fatura`, que também cria `entries.pair_id`.
- Fatura por ciclo (`faturasDoCartao`, `fechamentoDoCiclo`, `vencimentoDaFatura` e `limiteDoCartao`, em contracts): a compra entra na fatura do ciclo da data dela (até o dia de fechamento, inclusive); o pagamento (transferência para o cartão) entra na última fatura fechada antes da data dele. Status: aberta (hoje até o fechamento), paga (o pago cobre o total, ou total zero), vencida (passou do vencimento sem cobrir) e fechada. O vencimento cai no mesmo mês do fechamento quando o dia vem depois dele; senão, no mês seguinte. Limite: usado é o que o cartão deve hoje; disponível e percentual aparecem quando há limite.
- Pagar fatura: `POST contas/:id/pagar-fatura` com `{ fromAccountId, cents, date, month }`. Cria o par de lançamentos de transferência com o mesmo `pairId`, na sessão "Entre contas" do grupo "Transferências" (os dois nascem no primeiro uso): saída na conta de origem e entrada no cartão, fora da sobra, porque a compra já entrou na sobra no dia dela. Recusa pagar a partir de outro cartão. `GET contas/:id/faturas` devolve faturas e limite; conta comum recusa.
- Par de transferência: `pairId` em `Lancamento`, `PedidoLancamento` e `NovoLancamento`. Apagar um lado apaga o outro (`ExclusoesService.lancamento`), soltando antes as linhas de extrato dos dois. Exportar e importar dados levam `pairId` e os campos do cartão; a importação dá ids novos aos pares.
- Notificações (`avisosDeCartao`, na varredura das 8h, por cartão): fatura aberta que fecha em até dois dias (tipo vencimentos), fatura fechada que vence em até três dias ou hoje, fatura vencida, e limite do cartão aos 80% e 100% (tipo limites). Destino novo `contas` em `TELAS_DE_DESTINO` (o web abre `/contas`). `NotificacoesModule` passou a importar `ContasModule`.
- Tela de Contas, no cartão: seção "Faturas" com fechamento e vencimento, limite usado, disponível e percentual, a lista das últimas seis faturas (status em chip, total, pago, compras) e os botões "Pagar fatura" (fechada ou vencida) e "Pagar antecipado" (aberta), com o diálogo de `faturas.tsx` (conta de origem, valor preenchido com o que falta, data). Sem fechamento e vencimento, a seção explica o que falta em Editar. O diálogo da conta mostra "Fecha dia", "Vence dia" e "Limite" quando o tipo é cartão.
- Assistente: `criar_conta` e `editar_conta` aceitam `closingDay`, `dueDay` e `limitCents`; ferramentas novas `consultar_faturas` e `pagar_fatura` (com confirmação); `consultar_contas` mostra o ciclo e o limite; regra no prompt.

Motivo: o cartão era só um rótulo, e o pagamento da fatura lançado no banco contava a compra duas vezes.

Verificação: no ambiente local, por sonda na API, cartão que fecha dia 25 e vence dia 5, com compras de 100 e 50 em outubro (antes e depois do fechamento) e 30 em novembro, deu faturas setembro paga (0), outubro vencida (100) e novembro aberta (80), limite usado 180 de 3.000; pagar outubro a partir do banco criou o par (saída no banco, entrada no cartão, sessão Transferências › Entre contas), outubro ficou paga, o banco foi de 5.000 para 4.900 e o cartão passou a dever 80; apagar a saída apagou a entrada; pagar de outro cartão e pedir fatura de conta comum deram 409. Testes do backend (525, com faturas, limite, vencimento e os avisos do cartão), tsc e lint limpos; telas conferidas em 375 e 1280 px.

Não feito (lotes seguintes): a Conferência ainda não marca a linha "pagamento de fatura" do extrato como transferência (lote 3); mobile sem faturas (lote 4).

Atenção ao subir: a migração roda sozinha quando o `backend` sobe. Cartões existentes ficam sem fechamento e vencimento até a pessoa preencher em Editar; até lá, a seção Faturas só explica o que falta.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261109190000_cartao_com_fatura/` (novo)
- `packages/contracts/src/index.ts`
- `apps/backend/src/contas/` (`contas.controller.ts`, `aplicacao/contas.service.ts` e spec, `adaptadores/prisma-contas-repositorio.ts`)
- `apps/backend/src/financas/` (`dominio/pedido.ts`, `portas/financas-repositorio.ts`, `adaptadores/prisma-financas-repositorio.ts`)
- `apps/backend/src/exclusoes/aplicacao/exclusoes.service.ts` e spec
- `apps/backend/src/dados/dominio/pacote.ts`
- `apps/backend/src/notificacoes/` (`dominio/avisos.ts` e spec, `aplicacao/varredura.service.ts`, `notificacoes.module.ts`)
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/assistente/` (`adaptadores/rotas-das-ferramentas.ts`, `dominio/resultados.ts`)
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/contas/` (`faturas.tsx`, novo; `dialogo.tsx`, `page.tsx`)
- `apps/frontend/app/api/contas/[id]/faturas/route.ts` (novo)
- `apps/frontend/app/api/contas/[id]/pagar-fatura/route.ts` (novo)
- `apps/mobile/src/paginas/contas/movimentos.spec.ts`

## Transferência em par: entre contas e pela Conferência

A transferência tinha um lado só: a conta de destino não mudava, e a Conferência não sabia marcar uma linha do extrato como transferência.

O que foi feito:

- `ContasService.criarPar`: cria os dois lançamentos de uma transferência (saída na origem, entrada no destino) com o mesmo `pairId`, na sessão "Entre contas" do grupo "Transferências", fora da sobra. Se o segundo falhar, o primeiro é desfeito. `pagarFatura` passou a usar esse mesmo par.
- Transferir entre contas: `POST contas/transferencias` com `{ fromAccountId, toAccountId, cents, date, note }`. Os lançamentos se chamam "Transferência para X" e "Transferência de Y", e a observação vira a descrição. Recusa a mesma conta nos dois lados. Na tela de Contas, o botão "Transferir" no cabeçalho (aparece com duas contas ou mais) abre o diálogo de `transferir.tsx`.
- Linha do extrato como transferência: `POST extratos/transferir` com `{ statementId, line, accountId }`. Linha saindo vira saída da conta do extrato para a outra conta; linha entrando, o contrário. Nasce o par, a linha cruza com o lado dela (como lançamento criado pela linha) e a linha espelho do extrato da outra conta (mesmo valor com sinal trocado, até três dias de diferença, a mais próxima) cruza com o outro lado. Recusa a própria conta do extrato e linha já cruzada ou ignorada. Na Conferência, o botão "Transferência" ao lado de "Dividir" em cada linha livre abre o diálogo de `transferencia-da-linha.tsx`, que lista as outras contas. `ExtratosModule` passou a importar `ContasModule`.
- Desfazer uma linha cuja transferência nasceu dela apaga os dois lados e solta a linha espelho (`excluirCriado` em `ExtratosService`). Apagar um lado em Finanças já apagava o outro (lote 2).
- Assistente: ferramentas novas `transferir_entre_contas` (com confirmação) e `transferir_linha_do_extrato`. O prompt manda usar o par em vez de um lançamento solto com `transfer: true`, e marcar Pix para a própria conta, pagamento de fatura e aplicação como transferência na Conferência.

Motivo: a transferência tinha um lado só e a Conferência não sabia marcar uma linha como transferência.

Verificação: no ambiente local, por sonda na API, transferência de 200 do Itaú (1.000) para a Carteira (0) deu 800 e 200, com o par na sessão Transferências › Entre contas; extrato do Itaú com Pix de −150 em 05/11 e extrato da Carteira com +150 em 06/11: marcar a linha do Itaú como transferência cruzou as duas linhas, saldos 650 e 350; desfazer a linha do Itaú apagou o par e soltou a linha da Carteira; mesma conta nos dois pedidos deu 409. Testes do backend (526), tsc e lint limpos; diálogos conferidos em 375 px.

Atenção ao subir: nada além das migrações já listadas nas seções anteriores.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/contas/` (`contas.controller.ts`, `aplicacao/contas.service.ts`)
- `apps/backend/src/extratos/` (`extratos.controller.ts`, `extratos.module.ts`, `aplicacao/extratos.service.ts` e `aplicacao/extratos.service.lote.spec.ts`)
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/contas/` (`transferir.tsx`, novo; `page.tsx`)
- `apps/frontend/app/extratos/conferencia/` (`transferencia-da-linha.tsx`, novo; `page.tsx`)
- `apps/frontend/app/api/contas/transferencias/route.ts` (novo)
- `apps/frontend/app/api/extratos/transferir/route.ts` (novo)

## Começo guiado e mobile

A pessoa não tinha um caminho claro para começar hoje, e o celular não mostrava caixinhas nem patrimônio e não criava conta.

O que foi feito:

- Web, tela de Contas: bloco "Comece por aqui" (`comece.tsx`) com quatro passos e o estado de cada um (Feito ou Opcional): a conta do banco com o saldo de hoje (o botão abre Nova conta), o cartão com a fatura em aberto (abre Nova conta já no tipo cartão, via `tipoInicial` no `DialogoDeConta`), as caixinhas e os extratos (link para Importações). O bloco some quando já existe uma conta comum e ao menos um extrato. Substituiu o texto vazio antigo.
- Mobile, Contas: cartão de patrimônio no topo (total, nas contas, nas caixinhas, nos cartões); cada conta mostra quantas caixinhas tem e quanto guardam; botão "+" no cabeçalho e no estado vazio abre o modal `NovaConta.tsx` (nome, tipo, saldo de hoje, data e, no cartão, fechamento, vencimento e limite; no cartão o saldo digitado vira fatura em aberto, em negativo). A conta é criada por `POST /api/contas` pelo BFF.
- Mobile, detalhe da conta: "Saldo em DD/MM/AAAA", limite disponível e percentual no cartão, seção Faturas (últimas seis, status, vencimento, compras e pago; só leitura) e seção Caixinhas desta conta (saldo, rendimento do mês da tela e total). O movimento anterior ao saldo inicial aparece marcado "Antes do saldo inicial" e não muda o saldo, pelo `movimentosDoMes` compartilhado em contracts.
- Pagar fatura, conferir saldo, informar saldo da caixinha e transferir continuam só no web e pela IA.

Motivo: a pessoa precisa de um caminho claro para começar hoje, e o celular não mostrava caixinhas, patrimônio nem criava conta.

Verificação: tsc e lint do web e do mobile limpos, testes do mobile passam, build do Vite do mobile ok, frontend reconstruído no Docker. O bloco "Comece por aqui" não foi fotografado: o ambiente local já tem conta e extratos, então ele fica escondido ali. Não verificado no aparelho.

Atenção ao subir: nada novo. O mobile é construído à parte (`pnpm --filter mobile build`).

Arquivos:

- `apps/frontend/app/contas/` (`comece.tsx`, novo; `dialogo.tsx`, `page.tsx`)
- `apps/mobile/src/paginas/Contas.tsx`
- `apps/mobile/src/paginas/contas/` (`NovaConta.tsx`, novo; `DetalheDaConta.tsx`, `movimentos.ts`)

## A sobra de cada mês vira lançamento no mês seguinte, no grupo Conta

O que foi feito:

- `Entry.carryOf` (coluna `carry_of`, única por tenant), na migração `20261109210000_sobras_no_grupo_conta`: marca o lançamento que leva a sobra do mês AAAA-MM para o mês seguinte.
- `SobrasService.atualizar` (`contas/aplicacao/sobras.service.ts`): para cada mês desde o início do workflow até o mês anterior ao de hoje, o mês seguinte recebe, no dia 1, um lançamento único pago na sessão "Sobras" do grupo "Conta": "Sobra de <mês>" (entrada) quando a acumulada até ali é positiva, "Falta de <mês>" (saída) quando é negativa; zero não cria. O valor é a sobra acumulada até o mês anterior sem contar as próprias sobras levadas (`sobrasALevar` em contracts), então cada mês começa com o que veio de antes. Corrige o lançamento com valor ou data errados e apaga o de um mês que não existe mais. Grupo e sessão nascem no primeiro uso.
- Quando recalcula: `FilaDasSobras` (`contas/adaptadores/fila-das-sobras.ts`) registra consumidores do outbox para as operações que mudam a sobra (`operacoesQueMudamASobra` em contracts: todas as do agregado Lançamento, mais definir workflow, encerrar e remover sessão, remover grupo, permanecer ano, importar e zerar dados) e agenda um trabalho BullMQ por conta, com três segundos de espera e id `sobras-<tenant>`, para um lote de eventos virar um recálculo só; sem Redis, recalcula na hora. A varredura de 5 em 5 minutos também recalcula, para a virada do mês.
- `sobraAcumulada` ignora os lançamentos com `carryOf` (não dobra). Metas tira a sobra levada da sobra do mês (ela já está em "de antes"). Relatórios e Dashboard usam os lançamentos sem a sobra levada: mostram o dinheiro do próprio mês, e o Dashboard segue mostrando a acumulada à parte. Em Finanças, a sessão Sobras aparece no mês, então o total do mês já inclui o que veio de antes.
- A sessão das sobras e o grupo dela não podem ser apagados em Grupos; a mensagem explica que ela é recalculada sozinha.
- Caixinhas: o grupo das sessões delas passou a ser "Conta" (`GRUPO_DA_CONTA`; `GRUPO_DAS_CAIXINHAS` aponta para ele). A migração cria o grupo "Conta" onde havia "Caixinhas", move as sessões e apaga o grupo "Caixinhas" vazio. Textos da tela, do contrato e da IA atualizados.
- Exportar e importar levam `carryOf`. Prompt da IA: não criar, editar nem apagar esses lançamentos; a sobra do mês em Finanças já inclui o que veio de antes.

Motivo: a pessoa quer ver o que sobrou (ou faltou) de um mês como uma sessão no mês seguinte, junto das caixinhas, no grupo Conta.

Verificação: no ambiente local, a migração moveu a sessão "Caixinha Principal · Nubank" de Caixinhas para Conta e o grupo Caixinhas sumiu. Após uma mudança em lançamento, nasceram "Falta de agosto" (−3.515,82 em 01/09), "Falta de setembro" (−7.420,96 em 01/10) e "Falta de outubro" (−11.772,15 em 01/11), em Conta › Sobras; março a julho tinham sobra zero e não geraram lançamento. O "de antes" das Metas deu −11.772,15, igual à falta levada; Finanças em novembro fechou em −14.088,85, igual ao total das Metas; o Dashboard mostrou sobra do mês −2.316,70 e acumulada −14.088,85; o relatório de novembro ficou com saídas −2.316,70, sem a falta levada. Testes do backend (531), tsc e lint limpos.

Atenção ao subir: a migração roda sozinha e move as sessões das caixinhas. As sobras de meses passados nascem na primeira mudança em lançamento ou na varredura seguinte (até 5 minutos).

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261109210000_sobras_no_grupo_conta/` (novo)
- `packages/contracts/src/index.ts`
- `apps/backend/src/contas/` (`aplicacao/sobras.service.ts` e spec, novos; `adaptadores/fila-das-sobras.ts`, novo; `aplicacao/caixinhas.service.ts`, `contas.module.ts`)
- `apps/backend/src/financas/` (`dominio/pedido.ts`, `portas/financas-repositorio.ts`, `adaptadores/prisma-financas-repositorio.ts`)
- `apps/backend/src/metas/aplicacao/metas.service.ts`
- `apps/backend/src/exclusoes/aplicacao/` (`exclusoes.service.ts` e spec)
- `apps/backend/src/relatorios/aplicacao/relatorios.service.ts`
- `apps/backend/src/painel/aplicacao/painel.service.ts`
- `apps/backend/src/notificacoes/aplicacao/varredura.service.ts`
- `apps/backend/src/dados/dominio/pacote.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/contas/caixinhas.tsx`
- `apps/frontend/app/api/contas/[id]/caixinhas/route.ts`

## A IA lê os saldos e o patrimônio

O que foi feito:

- `ContasService.saldos` e `GET contas/saldos`, com o tipo `SaldosResposta` em contracts: o patrimônio de hoje (contas + caixinhas − cartões), o saldo de hoje e o previsto do fim do mês de cada conta (no cartão, o lançado e a fatura prevista), o saldo e o rendimento do mês de cada caixinha e a evolução do patrimônio nos últimos seis meses.
- Ferramenta nova da IA `consultar_saldos`, que todos os agentes leem, servida por essa rota. O resultado chega à IA formatado em `resultados.ts`.
- Prompt da IA: usar `consultar_saldos` quando a pessoa perguntar quanto tem; `consultar_contas` só traz o saldo inicial.

Motivo: as ações das telas de Contas já estavam com a IA, mas ela só enxergava o saldo inicial, não o saldo de hoje, as caixinhas nem o patrimônio.

Verificação: no ambiente local, `GET contas/saldos` devolveu patrimônio −11.572,16, igual ao saldo do Nubank na tela, a caixinha com saldo 0 e seis meses de evolução. Testes do backend (531) e tsc do backend e do agents limpos.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/contas/` (`aplicacao/contas.service.ts`, `contas.controller.ts`)
- `apps/backend/src/assistente/` (`adaptadores/rotas-das-ferramentas.ts`, `dominio/resultados.ts`)
- `apps/agents/src/assistente/dominio/prompts.ts`
