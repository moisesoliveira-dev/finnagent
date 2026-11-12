# Celular: Extratos na barra e anexos no chat

## Extratos como aba da barra de baixo

O que foi feito: Extratos virou uma aba da barra de baixo, entre Finanças e Assistente, com Importações e Conferência juntas na mesma tela. A barra passou a ter 6 abas (Início, Finanças, Extratos, Assistente, Agenda e Mais), com o rótulo um pouco menor para caber. Saíram da tela de Finanças o ícone de extrato do topo e os atalhos de Contas, Grupos e sessões e Relatórios, que continuam no Mais. A tela de Extratos deixou de ter o botão de voltar, e o Mais deixou de listar Extratos.

Motivo: Extratos é uso frequente e merecia um acesso direto, e a tela de Finanças ficou só com o mês.

Como foi verificado: `tsc` e build do app; conferido no celular (Samsung SM-S721B) que as 6 abas cabem e que Finanças começa no seletor de mês.

Arquivos:

- `apps/mobile/src/App.tsx`
- `apps/mobile/src/paginas/Extratos.tsx`
- `apps/mobile/src/paginas/Financas.tsx`
- `apps/mobile/src/paginas/Mais.tsx`
- `apps/mobile/src/tema/tema.css`

## Anexos no chat com o assistente

O que foi feito: o chat do app aceita anexos, como o do site. O "+" da caixa de mensagem abre "Anexar arquivo"; os arquivos escolhidos aparecem acima da caixa como etiquetas, com nome, tamanho e X para remover; a mensagem enviada mostra as mesmas etiquetas. Só o anexo, sem texto, basta. A leitura e os limites dos anexos (até 5 arquivos, 5 MB cada, 6 MB no total; CSV, OFX, texto, PDF e imagem) saíram do site para `packages/chat`, e o site passou a importar de lá, sem mudar de comportamento.

Motivo: o app não tinha como mandar um extrato ao assistente, e a leitura de anexos existia só no site.

Como foi verificado: `tsc` do app, 20 testes do app e 6 do `packages/chat` (3 novos, dos limites). A caixa de mensagem nova foi vista no celular. O anexo de um arquivo de verdade ainda não foi exercitado de ponta a ponta.

Limites conhecidos: o filtro por extensão do seletor de arquivos do Android pode ser ignorado em alguns aparelhos; o servidor confere o tipo mesmo assim.

Arquivos:

- `packages/chat/src/anexos.ts`
- `packages/chat/src/anexos.spec.ts`
- `packages/chat/src/index.ts`
- `apps/frontend/app/assistente/anexos.ts`
- `apps/mobile/src/paginas/Assistente.tsx`
- `apps/mobile/src/assistente/Mensagem.tsx`
- `apps/mobile/src/tema/tema.css`
