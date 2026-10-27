# Interface

## Dinheiro em texto e linha do calendário

O que foi feito: `formatarReais` passou a ser exportado por `components/ui/money.tsx`, e o próprio `Money` o usa. Ele substitui os dois formatadores de moeda que metas e a conferência de extratos tinham por conta própria. A célula do dia na agenda usa `min-h-16` e `tab:min-h-28`, da escala de espaçamento, no lugar de 68 e 108 px.

Motivo: a regra de interface manda um só formato de moeda e só valores da escala de espaçamento.

Arquivos:

- `apps/frontend/components/ui/money.tsx`
- `apps/frontend/app/metas/page.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/frontend/app/agenda/grade.tsx`
