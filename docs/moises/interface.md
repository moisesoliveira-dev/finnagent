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
