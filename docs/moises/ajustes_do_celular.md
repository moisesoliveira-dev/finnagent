# Valores ocultos, limites e Livre na Hoje, Já entra em e Conferência mais curta

## Valores ocultos, limites e Livre na Hoje, Já entra em e Conferência mais curta

Motivo: fechar o que sobrava das auditorias de UX e de consistência do celular numa só branch.

O que foi feito:

- Ocultar valores (web e app): um olho no cabeçalho esconde todos os valores em reais ("R$ ••••") e a escolha fica guardada no aparelho. Na web: `components/ui/valores.tsx` (guarda a escolha, `BotaoDosValores`, `useValoresOcultos`), `formatarReais` e `Money` (`money.tsx`) passam a mostrar a máscara, ícones `olho` e `olho-cortado` em `icone.tsx`, botão no cabeçalho do celular e no canto do tablet e do desktop (`app-shell.tsx`); a área principal é desenhada de novo ao trocar (`key`), então nenhum texto com valor fica para trás. No app: `src/valores.ts`, `reais` (`api/formato.ts`) mascara e a casca `Pagina` ganhou o botão do olho e redesenha o conteúdo ao trocar. As entradas de texto (campos de digitar valor) não são mascaradas.
- Hoje do app (`paginas/Hoje.tsx`): o bloco "Livre até o fim do mês" (livre, por dia, de onde vem) e a lista de limites das sessões com a barra de uso, como na web. A frase "Sem folga" usa a classe `erro` (a `.neg` do app força `nowrap` e cortava a frase), e `.cartao` ganhou coluna `minmax(0, 1fr)` (`tema.css`) para o texto quebrar em vez de esticar a coluna.
- Lançamento do app (`paginas/financas/FormLancamento.tsx`): campo "Já entra em" (`coveredById`: o lançamento que já conta este valor, para não somar duas vezes na sobra), na criação e na edição, e "Compromisso" (liga a um compromisso do mês, só na edição, `POST lancamentos/:id/compromisso` depois de salvar), como na web.
- Adiantar parcelas e empréstimo: decidido não criar o botão. A tela de série da web já tem Pagar (com data e valor reais) e Quitar, que cobrem o caso. Foram removidas as duas rotas da web que ninguém chamava (`app/api/lancamentos/[id]/parcelas/adiantar` e `emprestimo/adiantar`). As ferramentas da IA `adiantar_parcelas` e `adiantar_emprestimo` ficam, e a descrição delas foi corrigida em `packages/contracts/src/index.ts`: marcam como paga a próxima parcela pendente, no valor previsto (uma por chamada), e mandam usar `registrar_pagamento` para data e valor reais; antes diziam que adiantavam "as parcelas restantes" e "o restante".
- Conferência na web (`app/extratos/conferencia/page.tsx`, etapa 2, de forma enxuta): no celular, cada linha mostra o essencial (descrição, valor, busca de sessão e Acumular) e as outras opções (nome, dividir, transferência, tipo e o lançamento candidato) ficam atrás de "Mais opções", por linha; a linha com sugestão já vem aberta, porque cruzar é o caminho principal. A partir de 760 px nada mudou. Nenhuma lógica das ações foi tocada.

Verificação: na web (375 px), o olho em Dashboard (6 valores visíveis, depois 0), Contas (14, depois 0) e Finanças (1, depois 0), com a escolha mantida ao navegar; a Conferência de outubro (207 linhas, só leitura) com 20 linhas, 0 seletores à vista e 5.999 px de altura (era 7.919 px com a janela e 69.836 px sem ela), "Mais opções" abrindo só a linha tocada, e em 1100 px os seletores à vista. No app Ionic (Vite, 375 px, sessão de teste), o bloco Livre na Hoje, o olho trocando os valores por "R$ ••••" e o formulário de edição de um lançamento de teste (criado e apagado) com "Já entra em", "Compromisso" e a dica. `tsc` limpo em frontend e mobile; 547 testes do backend, 61 do agents e 20 do app passando.

Não verificado: aparelho físico; salvar um lançamento com "Já entra em" ou "Compromisso" preenchidos no app (só os campos foram conferidos, para não gravar nos dados da pessoa); os limites das sessões na Hoje do app com dados (o banco local não tem sessão com limite, só o bloco Livre apareceu); o olho junto de gráficos (as barras do patrimônio continuam desenhadas, sem valores).

Fica de fora: o `tsc` da web ainda cita as rotas removidas dentro de `.next/` (cache do Next, ignorado pelo Git, que se regenera no próximo build).

Atenção ao subir: nada.

Arquivos:

- `apps/frontend/components/ui/valores.tsx` (novo)
- `apps/frontend/components/ui/money.tsx`
- `apps/frontend/components/ui/icone.tsx`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/frontend/app/api/lancamentos/[id]/parcelas/adiantar/route.ts` (removido)
- `apps/frontend/app/api/lancamentos/[id]/emprestimo/adiantar/route.ts` (removido)
- `apps/mobile/src/valores.ts` (novo)
- `apps/mobile/src/api/formato.ts`
- `apps/mobile/src/componentes/Pagina.tsx`
- `apps/mobile/src/paginas/Hoje.tsx`
- `apps/mobile/src/paginas/financas/FormLancamento.tsx`
- `apps/mobile/src/tema/tema.css`
- `packages/contracts/src/index.ts`
