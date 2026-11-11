# Contas: dados consistentes entre web e celular

## Valores e saldo do cartão iguais na web e no celular

Uma revisão de consistência achou que digitar o mesmo valor dava resultados diferentes na web e no celular e que editar um cartão na web invertia o saldo.

O que foi feito:

- `lerReais` em `packages/contracts/src/index.ts`: a única leitura de reais em centavos, com sinal (aceita "1.234,56", "1234.56", "-50", "R$ 12,5"; recusa letras, mais de duas casas e o que passa de 2.147.483.647). A web (`financas/reais.ts`, `reaisParaCentavos`, zero continua sendo "sem valor") e o mobile (`api/formato.ts`, `centavosDe`, sem sinal) passam a usá-la. A cópia local de `NovaConta` apagava todos os pontos e lia "12.5" como R$ 125; agora usa `lerReais` e mantém o sinal.
- Saldo inicial na web (`contas/dialogo.tsx`): o campo só aceitava dígitos e mostrava o saldo sem sinal, então editar um cartão (ou conta no vermelho) salvava o valor positivo e invertia o saldo. O cartão agora grava sempre como dívida (negativo), como o mobile e a conferência já faziam; a conta ganhou a marca "Saldo negativo", que já vem marcada ao editar uma conta no vermelho. A dica do campo foi corrigida.
- Mobile: a fatura anterior sem compra, sem total e sem pagamento não aparece, como na web (`contas/DetalheDaConta.tsx`).
- Testes: 4 casos de `lerReais` e `centavosDe` em `apps/mobile/src/api/formato.spec.ts`.

Motivo: uma revisão de consistência achou que digitar o mesmo valor dava resultados diferentes na web e no celular e que editar um cartão na web invertia o saldo.

Verificação: no Compose local, um cartão de teste com saldo −R$ 50 aberto em Editar na web e salvo sem mexer continuou em −R$ 50 (o cartão de teste foi apagado depois). Não testado em aparelho.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/frontend/app/financas/reais.ts`
- `apps/frontend/app/contas/dialogo.tsx`
- `apps/mobile/src/api/formato.ts`
- `apps/mobile/src/api/formato.spec.ts`
- `apps/mobile/src/paginas/contas/NovaConta.tsx`
- `apps/mobile/src/paginas/contas/DetalheDaConta.tsx`
