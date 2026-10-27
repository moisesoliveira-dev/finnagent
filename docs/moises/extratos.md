# Extratos

## Importações

O que foi feito: a aba Importações recebe arquivo OFX ou CSV de até 5 MB, ligado a uma conta. CSV pede o mapeamento das colunas. A tela mostra o resumo, o histórico, as linhas, o reprocessamento e a exclusão. O conteúdo das linhas não entra no outbox.

Motivo: a pessoa passa a guardar e revisar os extratos enviados.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261007210000_extratos/`
- `apps/backend/src/extratos/`
- `apps/backend/src/main.ts`
- `apps/backend/src/app.module.ts`
- `apps/frontend/app/extratos/`
- `apps/frontend/app/api/extratos/`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/components/ui/button.tsx`
- `apps/frontend/components/ui/chip.tsx`

## Menu de Extratos

O que foi feito: o menu lateral de Extratos tem duas entradas. Importações gerencia e adiciona os arquivos. Conferência mostra as linhas lidas, sugere o lançamento de mesmo valor e dia próximo, e a pessoa confirma no painel IA.

Motivo: a pessoa separa o envio do arquivo da revisão e do cruzamento.

Arquivos:

- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/app/extratos/`
- `apps/frontend/app/api/extratos/`
- `apps/backend/src/extratos/`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261007223000_cruzamento_da_linha/`
- `packages/contracts/src/index.ts`

## Foto e PDF

O que foi feito: a importação aceita foto e PDF. O Nest chama o agents, grava as linhas e a prévia aparece na tela. OFX e CSV continuam no backend.

Motivo: a pessoa precisa enviar foto ou PDF do extrato e ver as linhas na tela, com OFX e CSV ainda lidos no backend.

Arquivos:

- `apps/frontend/app/extratos/page.tsx`
- `apps/backend/src/extratos`

## Cruzamento seguro, desfazer e deduplicação

O que foi feito: se o pagamento falha depois de cruzar, o cruzamento é desfeito (em "Acumular" o lançamento criado também é removido). Novo "Desfazer cruzamento" (`POST /extratos/cruzamentos/desfazer` no backend e no BFF, com botão nas linhas cruzadas): a linha volta a "sem lançamento", a ocorrência volta a pendente e o compromisso do mês volta a "não feito". Pagar pelo extrato marca como feito o compromisso ligado ao lançamento no mês. Reprocessar ou excluir um extrato com linha cruzada é recusado, com mensagem para desfazer antes. Linhas iguais (data, valor, descrição) já gravadas em outro extrato da mesma conta são ignoradas com aviso; o mesmo arquivo na mesma conta é recusado, inclusive no OCR. Sessão de valor já lançada deixou de aparecer como destino em "Acumular". Mensagem "Adicional só cruza com entrada.".

Motivo: evitar ocorrência paga sem origem, permitir corrigir um cruzamento errado e impedir linhas duplicadas.

Arquivos:

- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/extratos/extratos.controller.ts`
- `apps/backend/src/extratos/dominio/cruzar.ts`
- `apps/backend/src/extratos/dominio/repetidas.ts`
- `apps/backend/src/extratos/dominio/repetidas.spec.ts`
- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
- `apps/backend/src/financas/aplicacao/financas.service.ts`
- `apps/backend/src/financas/portas/financas-repositorio.ts`
- `apps/frontend/app/api/extratos/cruzamentos/desfazer/route.ts`
- `apps/frontend/app/extratos/conferencia/page.tsx`

## Integração obrigatória e compromisso que acumula gastos

O que foi feito:

- A Conferência diz quando o mês está conferido: só quando há linhas e todas têm lançamento (campo `checked`). Enquanto sobrar linha sem lançamento, mostra o aviso de que cada uma precisa de lançamento ou sessão. O dashboard ganhou `semConferir` (linhas do período sem lançamento, mês ou ano) com aviso e atalho "Conferir agora"; nada trava a navegação.
- O compromisso da agenda ganhou `session_id` (migração `20261028120000_sessao_do_compromisso`, FK com `ON DELETE SET NULL`): só sessão aberta do tipo acúmulo é aceita. O formulário tem "Sessão que acumula os gastos"; o dia mostra "Acumula · Grupo / Sessão" e o total já pago na sessão naquele dia (`spentCents`).
- Na Conferência, linha sem relação em dia com compromisso que tem sessão vem com essa sessão sugerida e o selo "Compromisso: título". O nome já lançado antes vale mais; se dois compromissos do dia apontam para sessões diferentes, não há sugestão.
- Exportar e importar dados leva a sessão do compromisso; pacotes antigos continuam importando.
- Migração aplicada só no Postgres local do Compose.

Motivo: toda linha do banco precisa terminar integrada a um lançamento ou sessão, e gastos que se somam (uma saída, as corridas de um dia) acumulam no compromisso daquele dia.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261028120000_sessao_do_compromisso/migration.sql`
- `apps/backend/src/agenda/agenda.controller.ts`
- `apps/backend/src/agenda/agenda.module.ts`
- `apps/backend/src/agenda/aplicacao/agenda.service.ts`
- `apps/backend/src/agenda/adaptadores/prisma-agenda-repositorio.ts`
- `apps/backend/src/agenda/portas/agenda-repositorio.ts`
- `apps/backend/src/agenda/dominio/gasto.ts`
- `apps/backend/src/agenda/dominio/gasto.spec.ts`
- `apps/backend/src/agenda/aplicacao/ocorrencias.spec.ts`
- `apps/backend/src/extratos/extratos.module.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/backend/src/extratos/adaptadores/prisma-extratos-repositorio.ts`
- `apps/backend/src/extratos/portas/extratos-repositorio.ts`
- `apps/backend/src/extratos/dominio/sessao-do-compromisso.ts`
- `apps/backend/src/extratos/dominio/sessao-do-compromisso.spec.ts`
- `apps/backend/src/painel/painel.module.ts`
- `apps/backend/src/painel/aplicacao/painel.service.ts`
- `apps/backend/src/painel/dominio/avisos.spec.ts`
- `apps/backend/src/painel/dominio/montar.spec.ts`
- `apps/backend/src/dados/dominio/pacote.ts`
- `packages/contracts/src/index.ts`
- `apps/frontend/app/page.tsx`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/agenda/itens.ts`
- `apps/frontend/app/agenda/lista.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`
