# Dados

## Exportar e importar dados

O que foi feito: em Dados e privacidade, Exportar baixa um JSON com grupos, sessões, lançamentos (com ocorrências, ajustes e valores por mês), compromissos, agendas, contas, extratos com o arquivo original, metas, permanências do ano, preferências e a data do workflow. Importar lê esse arquivo e troca os dados do tenant pelos dele em uma transação só, depois de uma confirmação. Todos os ids são refeitos na importação, mantendo os vínculos, porque o id é único no banco inteiro e colidiria com o de quem exportou.

Motivo: outro usuário do sistema carrega o arquivo e passa a ter os mesmos dados funcionando. Segredo do Google, token, chave da IA, ids de calendário Google e ids de evento do Google ficam fora do arquivo, pois pertencem a quem exporta. O limite do corpo JSON subiu para 64 MB por causa dos extratos.

Arquivos:

- `apps/backend/src/dados`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/main.ts`
- `apps/frontend/app/api/dados`
- `apps/frontend/app/configuracoes/painel.tsx`
