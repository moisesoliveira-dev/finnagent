# Metas com prioridade

## Metas com sessão, prioridade e divisão da sobra

O que foi feito: a tela de Metas ganhou anel de progresso, sessão de acúmulo por meta, ordem de prioridade e divisão da sobra por porcentagem.

- **Tela:** anel de progresso em cada meta (traço azul desenhado do topo; verde quando alcançada), etiqueta de prazo, grade de 1, 2 e 3 colunas e resumo no topo: sobra, separado este mês, livre, guardado e quanto separar por mês, com "Cabe na sobra" ou "Passa da sobra". Excluir virou botão só com ícone.
- **Grupo e sessão:** a primeira meta cria o grupo "Metas" e cada meta ganha uma sessão de acúmulo com o nome dela (nome repetido dá 409 "Já existe uma meta com esse nome."). O valor já separado vira uma saída paga na sessão (negativo). O guardado da meta é o que a sessão acumulou: pendente e paga entram, cancelada e estornada não, entrada abate. O botão "Separar valor" lança mais uma saída. Excluir a meta encerra a sessão só se ela nunca recebeu lançamento. Tudo no grupo Metas sai da sobra e conta como separado, inclusive o de meta já excluída.
- **Mês de referência:** a sobra e o prazo contam a partir de hoje, não do início do workflow.
- **Prioridade:** modal "Organizar prioridade" com arrastar (`Reorder` do motion) e botões subir e descer. A ordem vale para o "Pede da sobra"; meta nova entra no fim; o cartão mostra "Prioridade N".
- **Divisão da sobra:** modal "Dividir a sobra" com porcentagem por meta (campo de texto só com dígitos, de 0 a 100, limitado ao que resta para fechar 100% somando as outras metas, incluindo as já aprovadas). A divisão fica como "Proposta do mês". A pessoa aprova meta a meta ("Aprovar") ou todas ("Aprovar todas"); só então a saída é lançada na sessão, com a porcentagem sobre a sobra daquele momento. Aprovada não muda e só vale uma vez por mês.

Como funciona:

- **backend:** rotas `PUT /metas/ordem`, `PUT /metas/divisao`, `POST /metas/:id/aprovar` e `POST /metas/:id/separar`. O serviço de metas usa o `GruposService`, que o módulo de grupos passou a exportar.
- **banco:** migrations `20261029150000_metas_com_sessao` (coluna `session_id` em `goals`), `20261029160000_ordem_das_metas` (coluna `position`, preenchida pela ordem dos nomes) e `20261029170000_divisao_da_sobra_das_metas` (tabela `goal_allocations`, com CHECK de 0 a 100).
- **outbox:** `reordenar-metas`, `dividir-sobra-das-metas` e `aprovar-sobra-da-meta`, além dos de criar grupo, sessão e lançamento.
- **frontend (BFF):** rotas `/api/metas/ordem`, `/api/metas/divisao`, `/api/metas/[id]/separar` e `/api/metas/[id]/aprovar`.

Motivo: a meta guardava só um número solto; ligá-la a uma sessão deixa o valor separado rastreável nos lançamentos e a sobra passa a ser repartida por prioridade e porcentagem.

Como foi verificado: backend com 306 testes passando (novos: criação com grupo e sessão, sobra, reordenar, divisão e aprovação); tsc limpo em backend, frontend e agents. Fluxo real contra o banco: criar, nome repetido 409, separar 750 = 500 + 250, divisão 30% + 20% de R$ 1.000 = R$ 300 e R$ 200, aprovar uma vez, aprovar de novo recusado, passar de 100% recusado, mudar a divisão mantendo a aprovada. Arrasto com mouse real no Chrome; digitação no campo de porcentagem (letras ignoradas, 250 vira 100, 50 vira 30 quando restam 30). O modal de dividir só foi visto em captura no celular escuro.

Limites conhecidos: metas antigas, sem sessão, seguem com o valor gravado e não têm Separar nem Aprovar; a sessão de uma meta excluída com valor continua aberta no grupo Metas como histórico; o valor aprovado usa a sobra do momento da aprovação, que pode diferir do mostrado se ela mudou.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261029150000_metas_com_sessao`
- `apps/backend/prisma/migrations/20261029160000_ordem_das_metas`
- `apps/backend/prisma/migrations/20261029170000_divisao_da_sobra_das_metas`
- `apps/backend/src/metas` (controller, módulo, serviço e spec, porta, `dominio/guardado.ts`, adaptador Prisma)
- `apps/backend/src/grupos/grupos.module.ts`
- `apps/frontend/app/metas/page.tsx`
- `apps/frontend/app/api/metas` (`ordem`, `divisao`, `[id]/separar`, `[id]/aprovar`)
