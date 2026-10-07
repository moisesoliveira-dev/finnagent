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
