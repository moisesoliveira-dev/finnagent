# Usuários

## Master e membros por conta

O que foi feito: cada conta (tenant) passou a ter vários usuários e um só master. Quem se cadastra em `/cadastro` vira o master de uma conta nova. O master adiciona e remove membros em Configurações, na seção Usuários: informa nome, e-mail e uma senha inicial, que repassa à pessoa. O membro entra com o próprio e-mail e vê os mesmos dados da conta. A remoção derruba as sessões do membro na hora, e o e-mail dele volta a ficar livre.

Como a regra é garantida: no banco, a tabela `users` ganhou a coluna `role` (`master` ou `membro`), com `CHECK`, e um índice único parcial, `UNIQUE (tenant_id) WHERE role = 'master'`. Nem um `INSERT` nem um `UPDATE` direto cria um segundo master na mesma conta. O Prisma não descreve índice parcial, então ele vive só na migration. Os usuários que já existiam viram masters, e quem não declara o papel entra como membro (menor privilégio).

O que só o master faz: listar, criar e remover usuários (`/usuarios`) e exportar e importar os dados da conta (`/dados`), porque importar substitui tudo. O guarda global ganhou o decorator `@SoMaster()` e responde 403 ao membro. O master nunca é removido, e nenhum usuário mexe em outra conta: a busca da remoção filtra pelo tenant da sessão. Em desenvolvimento sem login, o usuário "sem login" conta como master. O restante (finanças, agenda, extratos) continua aberto a todos os usuários da conta, e as configurações da conta, como as chaves do Google e da IA, também.

Eventos no outbox, na mesma transação: `criar-usuario` (agora com o papel) e `remover-usuario`. A criação do master e do membro usa o mesmo evento.

Limites conhecidos: não há troca nem recuperação de senha, então o master combina a senha inicial com a pessoa; não há convite por e-mail; não há como passar o papel de master para outro usuário.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261027180000_papel_do_usuario`
- `apps/backend/src/auth`
- `apps/backend/src/dados/dados.controller.ts`
- `packages/contracts/src/index.ts`
- `apps/frontend/app/api/usuarios`
- `apps/frontend/app/configuracoes/usuarios.tsx`
- `apps/frontend/app/configuracoes/painel.tsx`
