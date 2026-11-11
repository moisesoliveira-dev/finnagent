# Deslizar nas linhas, desfazer ao apagar e arrastar metas

## Deslizar nas linhas, desfazer ao apagar e arrastar metas

A auditoria de UX do celular mostrou que não havia gestos nas listas e que apagar pedia um alerta de "não pode ser desfeito".

O que foi feito:

- Mobile, `componentes/Deslizar.tsx`: uma linha que se leva para o lado com o dedo (`motion`, `touch-action: pan-y` para a página continuar rolando). Para a direita faz `inicio`, para a esquerda faz `fim`; passou de 96 px e soltou, a ação acontece; senão volta. Batida leve quando a ação passa a valer. O fundo com a ação (verde ou vermelho, quadrado, sem sombra) só aparece do lado para onde a linha foi levada. É um atalho: a mesma ação segue nos botões da tela.
- Mobile, Hoje: tarefa deslizada para a direita conclui ou reabre; para a esquerda apaga.
- Mobile, `useApagarComDesfazer.ts`: apagar sem o servidor saber até o prazo acabar. O item some da tela na hora, o aviso "Desfazer" fica 6 s acima da barra de abas e a exclusão só é enviada depois; "Desfazer" cancela e o item volta. Um por vez (apagar outro envia o anterior já); sair da tela ou mandar o app para o fundo também envia. Na Hoje substituiu o alerta "não pode ser desfeito" (também no botão Apagar da folha de edição). Como não muda o backend, serve para qualquer exclusão.
- Mobile, Metas: a prioridade se muda arrastando a alça (a mesma peça `Ordenavel` dos grupos), no lugar dos botões subir e descer; as setas do teclado na alça movem uma posição. Se o servidor recusar, a lista volta à ordem gravada.
- Web: o toast ganhou `desfazer(texto, aoDesfazer)` (botão "Desfazer", 6 s) e o mesmo gancho (`components/ui/use-apagar-com-desfazer.ts`) apaga a tarefa da página Hoje com desfazer; antes apagava na hora, sem aviso.
- Limpeza: duas importações de `Campo` sem uso, de uma etapa anterior (Agenda e DetalheDoLancamento).

Motivo: a auditoria de UX do celular mostrou que não havia gestos nas listas e que apagar pedia um alerta de "não pode ser desfeito".

Verificação: subindo o app Ionic no navegador (Vite) em 375 px com toque emulado e uma sessão de teste (token falso, usuário "sem login"), com tarefas criadas só para o teste e apagadas depois: deslizar concluiu e reabriu a tarefa no servidor; deslizar para apagar tirou da tela, mostrou "Desfazer" e o servidor ainda tinha a tarefa; "Desfazer" trouxe de volta; sem desfazer, o servidor apagou depois do prazo. Na web, o mesmo fluxo na página Hoje. Também verificado no app, de etapas anteriores que só tinham passado pelo compilador: a aba "Mais" e o destaque dela nas telas de fora, o botão flutuante, o rodapé fixo do formulário de lançamento, a máscara do valor (123456 vira 1.234,56; apagar um dígito dá 123,45), o calendário de data e o arrastar de grupos com o dedo (ordem salva no servidor e restaurada).

Não verificado: a ordenação de metas no app (o banco local não tem metas; usa a mesma peça dos grupos), aparelho físico e o toque háptico.

Fica para depois: deslizar para apagar na lista de Finanças do app (a lista vem do painel, que não diz se apagar é o lançamento inteiro ou uma ocorrência; precisa de uma mudança no contrato) e o menu de segurar para abrir (o "Duplicar" que a auditoria citava não existe como funcionalidade).

Atenção ao subir: nada.

Arquivos:

- `apps/mobile/src/componentes/Deslizar.tsx` (novo)
- `apps/mobile/src/useApagarComDesfazer.ts` (novo)
- `apps/mobile/src/paginas/Hoje.tsx`, `Metas.tsx`, `Agenda.tsx`
- `apps/mobile/src/paginas/financas/DetalheDoLancamento.tsx`
- `apps/mobile/src/tema/tema.css`
- `apps/frontend/components/ui/toast.tsx`
- `apps/frontend/components/ui/use-apagar-com-desfazer.ts` (novo)
- `apps/frontend/app/hoje/page.tsx`
