# Zerar dados

## Recomeçar em Configurações

O que foi feito: em Dados e privacidade, Recomeçar apaga lançamentos, grupos, sessões, agenda, extratos, metas, conversas da inteligência artificial e o histórico. Ficam preferências, data de início, feriados, calendários, usuários, provedores e o comportamento da inteligência artificial. Só o master confirma, digitando RECOMEÇAR. O evento `zerar-dados` entra no catálogo em `packages/contracts`, no grupo Dados, ao lado de `importar-dados`. O teste de eventos afirma a categoria.

Motivo: a pessoa recomeça a conta sem montar de novo o que já configurou.

Arquivos:

- `apps/backend/src/dados/dominio/zerar.ts`
- `apps/backend/src/dados/dominio/zerar.spec.ts`
- `apps/backend/src/dados/adaptadores/prisma-dados-repositorio.ts`
- `apps/backend/src/dados/aplicacao/dados.service.ts`
- `apps/backend/src/dados/dados.controller.ts`
- `apps/backend/src/dados/portas/dados-repositorio.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/eventos/dominio/evento.spec.ts`
- `apps/frontend/app/api/dados/zerar/route.ts`
- `apps/frontend/app/configuracoes/painel.tsx`
- `docs/moises/zerar_dados.md`
