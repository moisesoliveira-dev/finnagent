# Grupos

## Sessão Fixo com parcela, empréstimo e fixa

O que foi feito: a sessão Fixo (kind `valor`) passou a aceitar parcela, empréstimo e fixa (recorrente), além da única. Continua valendo uma transação por mês: a única ocupa o mês dela; parcela, empréstimo e fixa ocupam cada mês em que vencem (vencimento cancelado e multa não ocupam). O lançamento que cairia num mês já ocupado é recusado, com o mês por extenso na mensagem ("Esta sessão Fixo já tem transação em dezembro de 2026..."). A aprovação "em partes" da Conferência continua liberando mais uma no mês, e a extra continua só no Acúmulo. Trocar uma sessão para Fixo vale quando nenhum mês fica com duas transações e não há extra. A base protegida ("o acréscimo não altera o valor base") vale para qualquer mês que a transação ocupa. A Conferência acha a transação do Fixo pelo mês que ela ocupa, então a linha do extrato numa sessão Fixo com parcela paga a parcela em vez de criar outro lançamento. O formulário de Finanças continua começando o Fixo pela única. Textos atualizados em Grupos, na nova sessão da Conferência, na lista de sessões do assistente, no prompt do agents e na descrição da ferramenta no contrato.

Motivo: sessões de valor fixo, como um financiamento, também podem ser parcela ou recorrente.

Verificação: testes do backend (495), agents (60) e mobile (12) passando; tsc do backend, frontend e agents e oxlint e eslint limpos. Pela API local, com o Docker reconstruído: parcela 3x a partir de nov/2026 ocupa nov, dez e jan; única em dez recusada; única em fev aceita; parcela 2x a partir de jan recusada por janeiro; extra recusada; Acúmulo com parcela virou Fixo; a linha de extrato acumulada na sessão Fixo pagou a parcela sem criar lançamento. Dados de teste apagados. Não verificado: a tela no navegador.

Arquivos:

- `apps/backend/src/grupos/dominio/sessao.ts` e `sessao.spec.ts`
- `apps/backend/src/grupos/adaptadores/prisma-grupos-repositorio.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/assistente/dominio/resultados.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `packages/contracts/src/index.ts`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/extratos/conferencia/nova-sessao.tsx` e `tipo-da-linha.tsx`
