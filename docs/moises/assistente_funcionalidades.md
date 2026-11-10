# Assistente: funcionalidades atuais

## Assistente alinhado às funcionalidades atuais

O que foi feito:

- `consultar_hoje` passa a ser leitura. Antes o backend recusava essa ferramenta fora de um plano.
- Criar e editar lançamento pela IA envia `counterparty` e `principalCents`, porque o empréstimo era recusado. Também aceita `coveredById` ("Já entra em").
- `editar_lancamento` manda só os campos que mudam, para a rota nova `PATCH lancamentos/:id/campos`. O backend completa com o lançamento gravado (`formularioDoLancamento` em `financas/dominio/pedido.ts`, `FinancasService.formulario`). Conta, transferência, regra de vencimento e empréstimo não voltam mais ao padrão.
- A linha de `consultar_lancamentos` (`LinhaBase`) traz `accountId`, `paymentId`, `counterparty` e `coveredById`. O resultado para o modelo mostra esses campos e o uso dos limites das sessões. `listar_grupos_e_sessoes` mostra o limite da sessão.
- `atualizar_ocorrencia` aceita `paidOn` e `registrar_gasto_do_compromisso` aceita `name`. `editar_tarefa` sem `repeat` não apaga a repetição, e `movimentar_caixinha` recusa valor zero.
- Ferramentas novas: `consultar_eventos` com filtros, `consultar_historico_de_eventos`, `consultar_evento`, `consultar_preferencias_de_notificacao` e `salvar_preferencias_de_notificacao`.
- Instruções do consultor: no cartão, a compra é a saída e a fatura é transferência. Aprovar a parte da meta é passo de plano. Limites das sessões, eventos e preferências de notificação ficam ao alcance da IA. As descrições de `accountId`, `transfer`, `consultar_contas` e `editar_conta` foram atualizadas.
- Testes: rotas das ferramentas (empréstimo, edição por campos, repetição, caixinha zero, leitura do dia) e formulário do lançamento gravado. Todos usam modelo falso e não chamam o provedor.

Motivo: uma auditoria mostrou ferramentas da IA que falhavam ou desfaziam dados em relação ao que as telas fazem.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `apps/backend/src/assistente/adaptadores/executor-http.spec.ts`
- `apps/backend/src/assistente/dominio/resultados.ts`
- `apps/backend/src/financas/financas.controller.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/financas/dominio/pedido.ts`
- `apps/backend/src/financas/dominio/pedido.spec.ts`
- `apps/backend/src/financas/dominio/vista.ts`
- `apps/agents/src/assistente/dominio/consultor.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
