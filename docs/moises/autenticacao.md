# Autenticação

## Login, cadastro e sessão

O que foi feito: o Prumo passou a exigir conta. Há as telas `/login` e `/cadastro`, com painel de apresentação à esquerda a partir de 1100 px, e um botão Sair no menu. O backend ganhou o módulo `auth`: usuário e sessão no Postgres, senha com scrypt, sessão por token aleatório de 32 bytes (no banco fica só o hash SHA-256), validade de 7 dias, trava de 15 minutos na conta depois de 5 senhas erradas e teto de 30 tentativas por origem em 10 minutos. Um guarda global exige a sessão em toda rota, menos `GET /` e `auth/entrar` e `auth/cadastro`. O tenant passou a vir da sessão: o guarda sobrescreve o `x-tenant-id` que chegar, então o cliente não escolhe mais de quem são os dados.

No frontend, o token vive só em cookie `httpOnly`, `SameSite=Lax`, com prefixo `__Host-` e `Secure` em https. O `proxy.ts` leva quem não tem cookie para `/login` (guardando o destino, só caminho interno) e recusa com 403 pedido que altera dado vindo de outra origem. A resposta 401 da API apaga o cookie, e a tela manda a pessoa ao login. O `next.config.ts` envia cabeçalhos de segurança (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS e `frame-ancestors 'none'`).

Motivo: o tenant era fixo no frontend e qualquer um com acesso à URL via os mesmos dados. Para haver mais de uma pessoa usando o sistema, cada conta precisa do próprio tenant e a identidade tem de ser verificada no servidor.

Dados antigos: o tenant usado antes do login só é herdado pela conta cujo e-mail estiver em `AUTH_EMAIL_DONO` (variável nova do backend, no `.env.example`, no Compose e na tabela de `hospedagem`). Sem a variável, ninguém herda; as demais contas nascem vazias. Toda mudança de estado da autenticação grava o evento no outbox, na mesma transação: `criar-usuario`, `abrir-sessao`, `encerrar-sessao` (com o motivo `sair` ou `expirada`), `registrar-falha-de-acesso`, `bloquear-conta` e `zerar-falhas-de-acesso`. Os payloads levam só ids e datas: nunca token, hash da sessão, senha ou IP.

Contrato: `UsuarioDaConta`, `SessaoAberta`, `SENHA_MINIMA` e `SENHA_MAXIMA` ficam em `packages/contracts` e valem para o backend e o frontend. A casca de login e cadastro mora dentro do `AppShell`, onde a regra de interface permite valores arbitrários.

Limites conhecidos: o teto por origem fica em memória (há uma réplica por serviço); não há CSP completa, só `frame-ancestors`; não há recuperação de senha nem confirmação de e-mail.

Arquivos:

- `apps/backend/src/auth`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261027120000_autenticacao`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/app.controller.ts`
- `apps/frontend/proxy.ts`
- `apps/frontend/next.config.ts`
- `apps/frontend/app/login`
- `apps/frontend/app/cadastro`
- `apps/frontend/app/api/auth`
- `apps/frontend/app/api/_lib`
- `apps/frontend/components/auth`
- `apps/frontend/components/ui/app-shell.tsx`
- `packages/contracts/src/index.ts`
- `.env.example`
- `compose.yaml`
