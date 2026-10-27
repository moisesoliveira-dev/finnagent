# Perfil do usuário

## Perfil por usuário, segurança e sessões

O que foi feito: cada usuário tem o próprio perfil (não o da conta): nome, cargo ou ocupação (80), cidade (80), texto "sobre você" (240) e cor do avatar, a escolher entre sete cores que são pares de tokens da interface (azul, índigo, verde, âmbar, vermelho, amarelo, grafite); o avatar mostra as iniciais do nome. O e-mail é o acesso e não muda pelo perfil. No backend, rotas em `/perfil` sempre do usuário da sessão (o id vem do guard, nunca do corpo): GET e PATCH do perfil, POST `/perfil/senha`, GET `/perfil/sessoes` e POST `/perfil/sessoes/encerrar-outras`. A troca de senha confere a senha atual (erro 400, não 401, para o BFF não apagar o cookie de quem só errou), aplica a mesma regra de senha previsível do cadastro, limita a 5 tentativas por 15 minutos por usuário, encerra as outras sessões e mantém a atual. As sessões mostram o aparelho (navegador e sistema, lidos do User-Agent), qual é a deste aparelho e até quando valem; "encerrar as outras" fecha todas menos a atual. Cada mudança grava o evento no outbox na mesma transação (`atualizar-perfil` com a lista de campos mudados e sem os valores, `trocar-senha`, `encerrar-outras-sessoes`); atualizar sem mudança real não grava nada. Quem entrou sem login em desenvolvimento vê um perfil só de leitura. No frontend, a página `/perfil` tem um cartão com a pré-visualização ao vivo do que se digita (banner de pontos, avatar sobreposto, selo "Não salvo") ao lado de três abas (Perfil, Segurança, Sessões) com troca animada; a escolha de cor tem moldura que desliza; a nova senha tem medidor de força de quatro faixas. O pé do menu mostra o avatar e o nome e leva ao perfil, e troca na hora quando o perfil é salvo. Peças novas: `Avatar` em `components/ui/`. Migração `20261028180000_perfil_do_usuario` (quatro colunas em `users`). Testado de ponta a ponta pelo BFF no ambiente local.

Motivo: dar a cada pessoa da conta uma identidade própria e um lugar para cuidar da segurança do acesso.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261028180000_perfil_do_usuario/migration.sql`
- `packages/contracts/src/index.ts`
- `apps/backend/src/auth/perfil.controller.ts`
- `apps/backend/src/auth/auth.module.ts`
- `apps/backend/src/auth/aplicacao/auth.service.ts`
- `apps/backend/src/auth/aplicacao/auth.service.spec.ts`
- `apps/backend/src/auth/portas/auth-repositorio.ts`
- `apps/backend/src/auth/adaptadores/prisma-auth-repositorio.ts`
- `apps/backend/src/auth/adaptadores/prisma-auth-repositorio.perfil.spec.ts`
- `apps/backend/src/auth/dominio/perfil.ts`
- `apps/backend/src/auth/dominio/perfil.spec.ts`
- `apps/backend/src/auth/dominio/dispositivo.ts`
- `apps/backend/src/auth/dominio/dispositivo.spec.ts`
- `apps/backend/src/auth/dominio/pedido.ts`
- `apps/frontend/app/perfil/` (`page.tsx`, `cartao.tsx`, `aba-perfil.tsx`, `aba-seguranca.tsx`, `aba-sessoes.tsx`, `api.ts`)
- `apps/frontend/app/api/perfil/` (`route.ts`, `senha/route.ts`, `sessoes/route.ts`, `sessoes/encerrar-outras/route.ts`)
- `apps/frontend/components/ui/avatar.tsx`
- `apps/frontend/components/auth/conta-do-menu.tsx`
- `apps/frontend/components/auth/perfil-evento.ts`
- `apps/frontend/components/ui/movimento.tsx`
