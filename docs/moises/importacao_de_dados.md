# Importação de dados

## Ids renovados na importação

O que foi feito: a importação passou a renovar a conta de cada lançamento (`accountId`), a sessão de cada compromisso (`sessionId`) e as partes de linha de extrato (`statementLineParts`), junto com os demais ids. O arquivo cujas referências apontam para algo que não está nele é recusado com mensagem, em vez de falhar no banco.

Motivo: a importação dá ids novos a tudo, mas esses três vínculos ficavam com o id antigo, e o banco rejeitava a gravação por chave estrangeira (`entries_account_id_fkey`), o que dava erro interno em qualquer arquivo com lançamentos ligados a uma conta.

Como foi verificado: testes novos em `pacote.spec.ts`; e a importação real de um arquivo exportado (10 grupos, 299 lançamentos, 6 extratos) no Postgres local, num tenant descartável: falhava com o código antigo e importa com o corrigido. A causa no Railway não foi confirmada por log.

Limites conhecidos: a exportação ainda não leva `GoalAllocation` (divisão da sobra das metas), `Goal.sessionId`, `Goal.position` nem `Entry.coveredById`; esses dados não voltam numa importação.

Arquivos:

- `apps/backend/src/dados/dominio/pacote.ts`
- `apps/backend/src/dados/dominio/pacote.spec.ts`
