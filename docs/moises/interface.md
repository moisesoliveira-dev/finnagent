# Interface

## Dinheiro em texto e linha do calendário

O que foi feito: `formatarReais` passou a ser exportado por `components/ui/money.tsx`, e o próprio `Money` o usa. Ele substitui os dois formatadores de moeda que metas e a conferência de extratos tinham por conta própria. A célula do dia na agenda usa `min-h-16` e `tab:min-h-28`, da escala de espaçamento, no lugar de 68 e 108 px.

Motivo: a regra de interface manda um só formato de moeda e só valores da escala de espaçamento.

Arquivos:

- `apps/frontend/components/ui/money.tsx`
- `apps/frontend/app/metas/page.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/frontend/app/agenda/grade.tsx`

## Tela de login animada

O que foi feito: a tela de login e de cadastro ganhou animação com o `motion`, toda pelas peças de `components/ui/movimento.tsx`. Entraram as peças `Cascata` e `Passo`, para blocos que aparecem em sequência. O painel da marca tem um fio de prumo, que dá nome ao produto: pende do alto, balança até assentar, oscila enquanto o servidor confere a senha, treme se ela está errada e fica reto quando a pessoa entra. O título sobe palavra por palavra de dentro de uma máscara, os valores do mês de exemplo contam do zero, e a sugestão da IA alterna em ciclo entre pendente e confirmada, junto com a etiqueta da linha. O cartão se inclina e a trama de pontos desliza com o ponteiro. No formulário, os campos entram em cascata, o formulário chacoalha no erro, o botão troca o rótulo, mostra uma barra enquanto envia e confirma antes de a tela trocar, e o medidor de força da senha enche com mola. O cadastro avisa que a pessoa será o master da conta.

Movimento reduzido: quem pede menos movimento fica só com opacidade e vê os valores finais de uma vez, sem o ciclo nem a inclinação. Para isso, o HTML do servidor não depende mais da preferência: `ListaAnimada` e `ItemAnimado` (que já existiam) tinham `initial={reduzir ? false : ...}`, o que gerava erro de hidratação para essas pessoas em qualquer lista do app. Passaram a usar sempre a mesma variante, com `suppressHydrationWarning` no estilo inicial. A classe `sem-barra` esconde a barra de rolagem do painel enquanto o conteúdo entra deslocado. Ela fica fora de camada no CSS, porque o `*` com `scrollbar-width: thin` também está fora e venceria um utilitário do Tailwind.

Motivo: dar à tela de entrada uma identidade própria e a sensação de produto pronto, sem sair dos tokens e das peças de movimento do projeto.

Arquivos:

- `apps/frontend/components/ui/movimento.tsx`
- `apps/frontend/components/auth/painel-da-marca.tsx`
- `apps/frontend/components/auth/fio-de-prumo.tsx`
- `apps/frontend/components/auth/estado-do-acesso.ts`
- `apps/frontend/components/auth/formulario-de-acesso.tsx`
- `apps/frontend/app/globals.css`

## Estratégia de carregamento: esqueleto, botão em ação e servidor acordando

O que foi feito:

- Novo `components/ui/esqueleto.tsx` com `Esqueleto` (bloco reto `bg-surface-2` que pulsa na opacidade; parado com movimento reduzido), `Carregando` (reserva o espaço de uma faixa de totais e de N linhas, `role="status"` com texto só para leitor de tela; passados 3 s mostra "Acordando o servidor...", por causa do cold start do Railway serverless) e `PontoDeEspera`.
- `Button` ganhou a prop `carregando`: trava o botão, põe `aria-busy` e mostra o ponto de espera. Quem chama troca o rótulo pelo gerúndio.
- Os 15 textos soltos "Carregando X." (dashboard, finanças página/tabela/visão geral, agenda, grupos, metas, relatórios, eventos, extratos lista e linhas, configurações, usuários, conferência) passaram a usar `Carregando`.
- Conferência de extratos: `carregar` não apaga mais a lista (`setDados(null)` removido). Ao trocar de mês ou depois de cruzar, desfazer ou acumular, a lista fica esmaecida com `aria-busy` e `inert` até a resposta. Só a primeira carga mostra o esqueleto; em falha a lista some. Os botões da linha mostram "Cruzando", "Desfazendo" e "Lançando", e os de lote "Lançando".
- BFF (`app/api/_lib/backend.ts`): leitura (GET) tem prazo de 20 s e repete uma vez em 502/503/504 ou falha de rede. Escrita tem prazo de 60 s e nunca repete, para não duplicar efeito. Timeout responde 504 "O servidor demorou para responder. Tente de novo.".

Motivo: o usuário só via uma linha de texto durante a espera, a lista da conferência sumia a cada ação e o serviço serverless dormindo parecia travado.

Arquivos:

- `apps/frontend/components/ui/esqueleto.tsx`
- `apps/frontend/components/ui/button.tsx`
- `apps/frontend/app/api/_lib/backend.ts`
- `apps/frontend/app/page.tsx`
- `apps/frontend/app/agenda/page.tsx`
- `apps/frontend/app/configuracoes/painel.tsx`
- `apps/frontend/app/configuracoes/usuarios.tsx`
- `apps/frontend/app/eventos/page.tsx`
- `apps/frontend/app/extratos/page.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/tabela.tsx`
- `apps/frontend/app/financas/visao-geral.tsx`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/metas/page.tsx`
- `apps/frontend/app/relatorios/page.tsx`
