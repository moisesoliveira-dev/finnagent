# Ambiente

## Variável APP_ENV e login dispensado em desenvolvimento

O que foi feito: a variável `APP_ENV` escolhe o ambiente do frontend e do backend. Vazia, ou com qualquer valor diferente de `development`, vale como `production` e o login é obrigatório, como antes. Com `APP_ENV=development`, fora do Railway, o login é dispensado: o `proxy.ts` deixa as páginas abertas e o guarda do backend aceita a requisição sem sessão como o usuário "sem login", no tenant dos dados criados antes do login (`TENANT_LEGADO`). Uma sessão válida continua valendo mesmo em desenvolvimento, então dá para testar o login de verdade. A tela de entrada mostra o aviso "Modo desenvolvimento" com o atalho "Continuar sem entrar", e o pé do menu mostra "Dev, sem login". O backend registra um aviso no log ao subir nesse modo.

Trava de segurança: se `APP_ENV=development` chegar ao Railway por engano, o código ignora o valor, registra um erro no log e mantém o login. O Railway é reconhecido por `RAILWAY_ENVIRONMENT`, `RAILWAY_PROJECT_ID` ou `RAILWAY_SERVICE_ID`, que ele injeta em todo serviço. A regra fica em `packages/contracts` (`ambienteDe`, `estaNoRailway` e `loginDispensado`) e vale para os dois lados. Os dois lados decidem sozinhos: se só um deles estiver em desenvolvimento, o outro continua exigindo o login e nada abre.

Motivo: poder usar e testar o sistema localmente sem criar conta nem entrar a cada vez, com produção protegida por padrão.

Como usar: no `.env`, `APP_ENV=development` e `docker compose up --build`. Para voltar ao normal, apague o valor ou use `production`. A variável entra no `.env.example`, no Compose (frontend e backend) e nas tabelas de `hospedagem`.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/auth/sessao.guard.ts`
- `apps/backend/src/auth/aplicacao/auth.service.ts`
- `apps/frontend/proxy.ts`
- `apps/frontend/app/api/_lib/backend.ts`
- `apps/frontend/app/login/page.tsx`
- `apps/frontend/components/auth/formulario-de-acesso.tsx`
- `apps/frontend/components/auth/conta-do-menu.tsx`
- `.env.example`
- `compose.yaml`
