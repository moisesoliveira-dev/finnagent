# Formulários com valor em centavos, data em calendário e botão fixo no rodapé

## Formulários com valor em centavos, data em calendário e botão fixo no rodapé

A auditoria de UX do celular mostrou formulários com o botão de salvar no fim de uma lista longa, valor digitado como texto livre e data digitada à mão.

O que foi feito:

- Contrato: `mascaraDeValor` e `proximaMascara` (os centavos entram pela direita, "123456" vira "1.234,56") passam a morar em `packages/contracts/src/index.ts`; a web (`apps/frontend/app/financas/reais.ts`) só reexporta e o mobile usa a mesma.
- Mobile, valor: `CampoDeValor` em `componentes/Campo.tsx`, com teclado numérico e a máscara, no lugar do campo de texto em 20 pontos (Finanças, Contas, Metas, Grupos, Conferência, detalhe do lançamento). O texto guardado é o mostrado ("1.234,56"), que `centavosDe` lê. "Juros (%)" continua campo comum.
- Mobile, data: `componentes/Data.tsx`, calendário do Ionic numa folha com "Pronto", no molde do `Hora`, no lugar do seletor nativo em 14 pontos; `limpavel` onde a data pode ficar vazia ("Saldo em" da conta). A nova conta pedia a data como texto "AAAA-MM-DD".
- Mobile, rodapé fixo: `Folha` ganhou `rodape` (`IonFooter`), com o erro e o botão de salvar sempre visíveis e acima do teclado, enquanto os campos rolam. Migrados: lançamento, compromisso, nova conta, nova meta, grupo e sessão. Os botões de excluir ficam no corpo. `NovaConta` passou a usar a `Folha` e ganhou o interruptor "Saldo negativo" (o campo de valor só aceita dígitos).
- Web: no celular (menos de 760 px) o diálogo é uma folha colada embaixo, na largura da tela e com até 92% da altura, que sobe de baixo; os botões (`.dialog-acoes`) respeitam a área segura do aparelho. Em telas maiores nada muda (`globals.css`, `components/ui/dialogo.tsx`).
- Testes: 3 casos da máscara em `apps/mobile/src/api/formato.spec.ts`.
- Fora desta etapa, de propósito: erro por campo (hoje uma mensagem só no rodapé) e o rodapé fixo nos formulários curtos de Contas e nas folhas de Configurações.

Motivo: a auditoria de UX do celular mostrou formulários com o botão de salvar no fim de uma lista longa, valor digitado como texto livre e data digitada à mão.

Verificação: no Compose local, em 375 px o diálogo "Novo lançamento" fica colado embaixo (x 0, largura 375) com Cancelar e Criar lançamento fixos no rodapé; em 1100 px continua diálogo. `tsc` limpo em frontend e mobile; 20 testes do mobile passam. Não verificado: o app Ionic rodando (o calendário e o rodapé sobre o teclado), e aparelho físico.

Atenção ao subir: nada.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/frontend/app/financas/reais.ts`, `app/globals.css`, `components/ui/dialogo.tsx`
- `apps/mobile/src/componentes/Campo.tsx`, `Data.tsx` (novo), `Folha.tsx`
- `apps/mobile/src/paginas/Agenda.tsx`, `Configuracoes.tsx`, `Grupos.tsx`, `Hoje.tsx`, `Metas.tsx`
- `apps/mobile/src/paginas/agenda/FormCompromisso.tsx`
- `apps/mobile/src/paginas/contas/AcoesDaConta.tsx`, `NovaConta.tsx`
- `apps/mobile/src/paginas/extratos/Conferencia.tsx`
- `apps/mobile/src/paginas/financas/DetalheDoLancamento.tsx`, `FormLancamento.tsx`
- `apps/mobile/src/tema/tema.css`
- `apps/mobile/src/api/formato.spec.ts`
