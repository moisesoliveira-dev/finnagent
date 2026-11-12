# O saldo que já estava lá não é dinheiro do mês

## O saldo que já estava lá não é dinheiro do mês

Motivo: a pessoa apontou que o valor inicial de uma caixinha e o valor atual de uma conta já existiam antes e não podem contar nos cálculos do mês, mas "Informar saldo" da caixinha e "Conferir saldo" da conta lançavam a diferença como entrada.

O que foi feito:

- Diagnóstico, com lançamentos de teste (apagados depois) sobre a conta e a caixinha reais do ambiente local: aplicação e resgate na caixinha comum já eram transferência e não mexiam nas entradas do mês; mas informar R$ 10.000 numa caixinha com R$ 300 lançou "Rendimento" de R$ 9.700 como entrada, e conferir R$ 5.000 numa conta lançou um "Ajuste de saldo" de R$ 15.214,24 como entrada. O saldo inicial cadastrado (`openingCents`) nunca foi problema: não vira lançamento.
- Regra nova (`primeiroSaldoInformado` em `packages/contracts/src/index.ts`; `contas.service.ts` e `caixinhas.service.ts`): na primeira vez que a pessoa informa o saldo (saldo inicial ainda zero e nenhum ajuste na conta, nem rendimento na caixinha, vindo de um saldo informado antes), a diferença entre o saldo informado e o que os movimentos já lançados dão é o que já estava lá. Ela passa a ser o saldo inicial (`openingCents + diferença`, com a data do saldo inicial como estava), nenhum lançamento é criado e nada entra nas entradas nem na sobra do mês. Dos saldos seguintes em diante, a diferença segue sendo ajuste (conta) ou rendimento/perda (caixinha), como antes. A resposta traz `comoSaldoInicial: true` (`AjusteDeSaldo`). Vale também para o cartão, como fatura em aberto.
- Textos: toast ("O valor ficou como saldo inicial ...") e explicação no diálogo, na web (`app/contas/conferir-saldo.tsx`, `app/contas/caixinhas.tsx`) e no app (`paginas/contas/AcoesDaConta.tsx`); a descrição das ferramentas da IA `ajustar_saldo_da_conta` e `informar_saldo_da_caixinha` e o prompt do consultor (`prompts.ts`) dizem a regra.
- Testes: `saldo-inicial.spec.ts` (12 casos: primeira vez sem e com movimentos, saldo que já bate, depois de ajuste ou de rendimento, saldo inicial já definido, meta ligada preservada).

Verificação: de ponta a ponta no Compose local com a conta Nubank e a Caixinha Principal reais, restauradas no fim. Primeiro saldo da caixinha R$ 10.000 virou saldo inicial e as entradas continuaram 0; o seguinte (R$ 10.100) virou rendimento de R$ 100; primeiro saldo da conta R$ 5.000 virou saldo inicial de R$ 14.914,24 (o que faltava para bater com os movimentos dos extratos) sem mexer nas entradas; o seguinte (R$ 5.200) virou ajuste de R$ 200. `tsc` limpo; 577 testes do backend, 61 do agents e 20 do app passando. Um primeiro teste deixou um ajuste de R$ 14.914,24 no banco local por falha do script de teste; foi apagado e conferido (nenhum ajuste ou rendimento de teste restou).

Não verificado: as telas (só o texto foi trocado; o `tsc` passa) e aparelho físico.

Atenção: saldos informados antes desta mudança já geraram "Ajuste de saldo" ou "Rendimento" como entrada e continuam lançados. A pessoa deve apagá-los (grupo Ajustes, e a sessão da caixinha no grupo Conta) e informar o saldo de novo. Depois de um ajuste ou rendimento antigo, a regra trata o próximo saldo como ajuste normal.

Em aberto: a pessoa também disse que o dinheiro que vai para a caixinha deve contar como saída e não como entrada. Hoje a aplicação já é saída da conta, só que como transferência, fora da sobra (na caixinha de uma meta ela sai da sobra). Falta confirmar se ela quer que a aplicação em caixinha comum reduza a sobra do mês.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/contas/aplicacao/contas.service.ts`
- `apps/backend/src/contas/aplicacao/caixinhas.service.ts`
- `apps/backend/src/contas/aplicacao/saldo-inicial.spec.ts` (novo)
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/app/contas/conferir-saldo.tsx`
- `apps/frontend/app/contas/caixinhas.tsx`
- `apps/mobile/src/paginas/contas/AcoesDaConta.tsx`
