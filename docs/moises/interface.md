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

## Revisão geral: tags, toque, lint, camadas e observabilidade

O que foi feito:

- Tags: o `Chip` ganhou os tons `info` (azul), `pending` (âmbar) e `event` (índigo), e o `ok` passou a ser verde e o `neg` ganhou fundo. Cada uso foi recolorido pelo significado (pago e cruzado em verde, atraso e erro em vermelho, aguardando em âmbar, fixo, hoje e master em azul, agenda e acúmulo em índigo). Regra atualizada em `interface.md`.
- Grupos: a página abre com todos os grupos fechados; a busca continua abrindo os que têm resultado, e salvar uma sessão abre o grupo dela.
- Toque de 40 px no ícone de dica, no número do dia da agenda, nas caixas de marcar (`caixaDeMarcar` em `cn.ts`) e no link do assistente. As barras fixas de baixo deixam 48 px livres para o ícone da calculadora. No app mobile, "Em 1 dias" virou "Amanhã".
- Lint do frontend zerado (4 erros e 5 avisos): refs só mudam em efeito, a seção e a URI de retorno das configurações vêm da URL sem estado, a virada do ano abre o `Dialogo` por estado.
- Backend: o cliente HTTP do Google saiu de `agenda/` para `google/` (configurações importava o adaptador de outra slice). Duas operações que gravavam sem outbox passaram a gravar (`definir-pendencia-da-conversa`, `reabrir-sobra-da-meta`), registradas no catálogo. Avisos do oxlint zerados.
- Testes de propriedade com fast-check (divisão da linha, valor da fixa, chave do nome, ocorrência paga).
- Observabilidade, que só tinha o Sentry do agents: Sentry e OpenTelemetry ligam no backend, no frontend e no agents quando as variáveis existem. Só o backend manda métricas, porque métrica periódica mantém o serviço acordado no Railway. `hospedagem.md` e o Compose (`ARG` do DSN do navegador) ajustados.
- Extratos: lançamento do extrato que fica sem linha ao desfazer é apagado, com a migração que limpa as sobras (registrado em `extratos.md`).

Motivo: a pedido, revisar o sistema inteiro e corrigir inconsistências de layout, arquitetura e regras.

Verificação: `tsc` limpo em frontend, backend, agents, mobile e contracts; lint limpo no frontend e no backend; testes de backend (410), agents (56), chat e mobile passando; Docker reconstruído com os cinco serviços de pé; em 375 px, nenhuma tela rola na horizontal e sobraram só as caixas de marcar da Conferência (o toque delas é o do `label` de 40 px). Não verificado: envio real ao Sentry e ao Grafana (sem DSN nem endpoint locais) e o modo escuro das tags.

Arquivos: `apps/frontend/components/ui/chip.tsx`, `cn.ts`, `rotulo.tsx`; telas de `agenda`, `financas`, `grupos`, `metas`, `configuracoes`, `perfil`, `assistente`, `extratos`; `apps/backend/src/google/`, `instrumentar.ts`, `app.module.ts`; `apps/frontend/instrumentation*.ts`; `apps/agents/src/instrumentar.ts`; `compose.yaml`; `.claude/rules/interface.md` e `hospedagem.md`.

## Menu lateral com ícones, logo e recolhimento

- Cada item do menu ganhou um ícone (Dashboard, Assistente, Agenda, Finanças, Metas, Relatórios, Eventos, Extratos com Importações e Conferência, Grupos, Configurações), no `Icone` de `components/ui`.
- A logo do Prumo (o fio e o peso amarelo, em miniatura, `components/ui/logo.tsx`) está no alto do menu, como link para o início, e substitui o quadrado solto na marca do login também.
- A partir do tablet o menu recolhe para só ícones (64 px) e volta a 200 px pelo item "Recolher"/"Expandir" no fim da lista, com a seta que gira (ao lado da logo ele não cabia em 200 px). O menu não rola na horizontal no tablet. Recolhido, o nome de cada item vai para o `title` e para o leitor de tela, a conta mostra só o avatar, e "Sair" vira ícone. A escolha fica no `localStorage` (`prumo-menu-recolhido`), por navegador; sem armazenamento, o menu abre aberto. No servidor e na hidratação vale "aberto", para o HTML não divergir. No celular o menu segue na horizontal, com ícone e nome.
- O estado chega às peças do menu por `MenuContext` (`components/ui/menu-lateral.ts`). As larguras das colunas continuam as únicas exceções a valores arbitrários, dentro do `AppShell`.

Motivo: o menu era só texto, sem a marca, e não dava para ganhar espaço na tela.

Verificação: tsc e lint limpos; Docker reconstruído; no Chrome headless, em 1280 px, os dez links têm ícone, a logo aparece, recolher leva o menu a 64 px, a escolha sobrevive ao recarregar e expandir volta a 200 px; em 375 px a página não rola na horizontal. Não verificado: o tema escuro da logo e o app mobile, que não tem esse menu.

Arquivos:

- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/components/ui/menu-lateral.ts` (novo)
- `apps/frontend/components/ui/logo.tsx` (novo)
- `apps/frontend/components/ui/icone.tsx`
- `apps/frontend/components/auth/conta-do-menu.tsx`
- `apps/frontend/components/auth/painel-da-marca.tsx`
