# Geral

## Toasts de sucesso, erro e alerta

O que foi feito: mensagens de sucesso, erro e alerta do frontend passaram a aparecer num toast, no canto superior direito, por cima dos diálogos. Os três somem sozinhos depois de 5 segundos. O fechar é um ícone de X. O texto que era só feedback (falha ao carregar, validação de formulário, falha ao salvar e confirmação de ação) saiu do corpo da página. O que é dado da tela continua lá: erro de linha de extrato, mensagem de extrato que falhou, chips e estados vazios. Carregando continua no corpo da página.

Motivo: a pessoa pediu que sucesso, erro e alerta fossem mostrados por um toast.

Arquivos:

- `apps/frontend/components/ui/toast.tsx`
- `apps/frontend/app/globals.css`
- `apps/frontend/app/layout.tsx`
- `apps/frontend/app/page.tsx`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/metas/page.tsx`
- `apps/frontend/app/relatorios/page.tsx`
- `apps/frontend/app/eventos/page.tsx`
- `apps/frontend/app/extratos/page.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`

## Confirmação para excluir

O que foi feito: excluir grupo ou sessão abre um modal antes de apagar. O grupo avisa quando as sessões dele também saem. Meta e extrato já pediam essa confirmação.

Motivo: a pessoa pediu confirmação em modal para excluir qualquer coisa do sistema.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`

## Versionamento

O que foi feito: a regra passou a ter uma branch por tela, reutilizada nas atualizações dessa tela, e uma branch só para o sistema inteiro, `moises/geral`. O toast e a confirmação de exclusão saíram de `moises/avisos` e ficaram nesta branch.

Motivo: a pessoa não quer uma branch nova para cada assunto que atravessa o sistema.

Arquivos:

- `.cursor/rules/versionamento.mdc`
- `docs/moises/geral.md`
