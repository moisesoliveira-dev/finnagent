# Importação de dados

## Partes de linha de extrato na importação

O que foi feito: a importação passou a renovar os ids das partes de linha de extrato (`statementLineParts`) junto com os de extratos e lançamentos, e a recusar o arquivo cujas partes apontam para algo que não está nele.

Motivo: as partes mantinham os ids antigos enquanto extratos e lançamentos ganhavam ids novos, e o banco rejeitava a gravação por chave estrangeira, o que dava erro interno em qualquer arquivo com uma linha de extrato dividida.

Como foi verificado: dois testes novos em `pacote.spec.ts`, que falhavam antes da correção. A causa no Railway não foi confirmada por log.

Limites conhecidos: a exportação ainda não leva `GoalAllocation` (divisão da sobra das metas), `Goal.sessionId`, `Goal.position` nem `Entry.coveredById`; esses dados não voltam numa importação.

Arquivos:

- `apps/backend/src/dados/dominio/pacote.ts`
- `apps/backend/src/dados/dominio/pacote.spec.ts`
