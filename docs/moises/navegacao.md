# Navegação: barra de baixo e ação principal ao alcance do polegar

## Barra de navegação de baixo e ação principal ao alcance do polegar

Uma auditoria de UX do celular mostrou que a web só trocava de tela pela gaveta lateral, que o app escondia Hoje, Contas e Configurações, e que a ação principal ficava no alto da tela.

O que foi feito:

- Web no celular: barra fixa de baixo com Dashboard, Finanças, Assistente, Agenda e Mais, só abaixo de 760 px (`tab:hidden`), com a barra de 2 px que desliza na aba atual e a área segura do aparelho. O "Mais" abre uma folha que sobe acima da barra, com Hoje, Contas, Metas, Relatórios, Eventos, Extratos (Importações e Conferência), Grupos, Configurações e a Calculadora. O hambúrguer do cabeçalho e a gaveta lateral do celular saíram. A altura da barra é a variável `--barra-inferior` em `globals.css`, e a classe `acima-da-barra` mantém o que gruda na base da tela acima dela: o campo de mensagem do Assistente e o fim do conteúdo. O botão flutuante da calculadora some no celular (abre pelo "Mais") porque cobria conteúdo.
- Web, botão flutuante da ação principal: `botao-flutuante.tsx`, quadrado amarelo acima da barra, ligado por `flutuante` no `PageHeader`. Aplicado em Finanças (Novo lançamento), Agenda (Novo compromisso), Metas (Nova meta), Grupos (Nova sessão) e Importações (Importar extrato). No celular o amarelo do cabeçalho some (um amarelo por área) e a partir de 760 px tudo continua como antes.
- Mobile (Ionic): a aba Metas deu lugar ao "Mais" (`Mais.tsx`), uma lista com Hoje, Metas, Contas, Grupos e sessões, Relatórios, Extratos, Eventos e Configurações; telas fora das quatro abas contam como "Mais" no destaque da barra (`App.tsx`, regra `.ativa` em `tema/tema.css`). A casca `Pagina` ganhou `acao`: botão flutuante quadrado e amarelo (`IonFabButton`), que substituiu o "+" do cabeçalho de Finanças, Agenda, Metas, Contas e Grupos.
- Correção encontrada no caminho: em Importações, o nome longo do arquivo alargava o cartão e a página rolava na horizontal em 375 px (coluna do `grid` sem limite); `grid-cols-1` resolveu.

Motivo: uma auditoria de UX do celular mostrou que a web só trocava de tela pela gaveta lateral, que o app escondia Hoje, Contas e Configurações, e que a ação principal ficava no alto da tela.

Verificação: no Compose local, em 375 px e 1100 px, a barra aparece só no celular, destaca a aba certa (e o "Mais" nas telas de fora), a folha lista as telas e abre a calculadora, o campo do Assistente fica acima da barra, as cinco telas mostram um botão amarelo só (o flutuante no celular, o do cabeçalho no desktop) e não há rolagem horizontal. `tsc` limpo em frontend e mobile. Não verificado: o app Ionic rodando (só tipos) e aparelho físico.

Atenção ao subir: nada.

Arquivos:

- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/components/ui/botao-flutuante.tsx` (novo)
- `apps/frontend/components/ui/page-header.tsx`
- `apps/frontend/components/calculadora/calculadora.tsx`
- `apps/frontend/app/globals.css`
- `apps/frontend/app/assistente/chat.tsx`
- `apps/frontend/app/financas/page.tsx`, `agenda/page.tsx`, `metas/page.tsx`, `grupos/page.tsx`, `extratos/page.tsx`
- `apps/mobile/src/App.tsx`
- `apps/mobile/src/componentes/Pagina.tsx`
- `apps/mobile/src/paginas/Mais.tsx` (novo)
- `apps/mobile/src/paginas/Financas.tsx`, `Agenda.tsx`, `Metas.tsx`, `Contas.tsx`, `Grupos.tsx`
- `apps/mobile/src/tema/tema.css`
