# Tela de eventos

## Tela de Eventos com paginação e layout novo

O que foi feito: a lista de eventos passou a ser paginada no servidor e a tela ganhou um layout novo, inspirado no log de eventos do Stripe. As operações que caíam em "Sistema" ganharam categoria e o logout ganhou nome próprio.

- **Paginação no servidor:** 50 eventos por página, do mais novo ao mais antigo. Página e filtros (categoria, status, dia e busca) vão para o backend e ficam na URL (`?pagina=&categoria=&status=&dia=&q=&evento=&visao=`), então recarregar ou mandar o link mantém o lugar. Página além da última cai na última. O histórico também é paginado.
- **Layout:** lista à esquerda e detalhe fixo à direita no desktop. No celular e no tablet, o detalhe abre num diálogo.
- **Resumo por status:** concluídos, processando, pendentes e com falha viram filtros grandes, cada um com o seu número. Tocar de novo desfaz o filtro.
- **Volume por dia:** histograma dos últimos 30 dias (14 no celular), numa série só, em azul. Tocar num dia filtra a lista. Passar o mouse ou focar mostra o dia com a divisão por status, cada uma com nome e ponto.
- **Abas de categoria:** cada uma com a contagem. No celular rolam; no desktop quebram a linha.
- **Busca e Atualizar:** busca por tipo, agregado ou id, com espera ao digitar. O botão Atualizar ficou só com o ícone.
- **Linha do tempo:** agrupada por dia (Hoje, Ontem, dia da semana), com a hora no fuso da conta e um trilho com o ponto do status. O nome do status só aparece quando não é concluído.
- **Detalhe do evento:** categoria e origem, tipo, agregado e status; a linha do processamento (registrado, publicado e processado, com o tempo entre os passos); os dados (id, chave de idempotência, schema e correlação); e o payload mascarado, com botão Copiar.
- **Troca de página ou filtro:** a lista anterior fica esmaecida até a nova chegar, sem piscar o esqueleto.
- **Categorias:** nova categoria "Conta" (acesso, senha, perfil e usuários). Conversas e mensagens do assistente passaram para "Agente"; provedores de IA, assistente de IA e importação de dados para "Configurações"; `pagar-pelo-extrato` e `desfazer-cruzamento` para "Extratos"; feriados locais e `redatar-vencimentos` para "Financeiro". Um teste falha se o backend gravar na outbox uma operação sem categoria.
- **Logout com nome próprio:** o logout passou a gravar `encerrar-sessao-de-acesso`. Antes gravava `encerrar-sessao`, o mesmo nome do encerramento de sessão de finanças, e a tela não tinha como separar os dois.

Como funciona:

- **contracts** (`packages/contracts`): tipos `PaginaDeEventos`, `PaginaDoHistorico` e `DetalheDoEvento`; esquemas Zod dos filtros, em que valor inválido vira o padrão; a tabela `OPERACOES_DE_EVENTO`, com categoria, agregado e origem de cada operação, usada pelo banco e pela tela; `STATUS_DA_LINHA`, os nomes dos status pelo andamento na fila, usados por `statusDaLinha` e pelo SQL, para o filtro e a contagem do banco não divergirem da tela; `eventoDaLinha` e `historicoDoEvento`. O `Evento` ganhou `publishedAt` e `consumedAt`. Saiu `montarEventos`.
- **backend:** rotas `GET /eventos`, `GET /eventos/historico` e `GET /eventos/:id`. O adaptador monta SQL parametrizado (`Prisma.sql`) com a tabela de operações como `VALUES`. Categoria, status e dia (no fuso da conta) são calculados no banco, e cada contagem ignora o próprio filtro. A busca olha o texto do tipo, do agregado e da origem e, só quando o texto parece começo de id (letras, números e hífen), o começo do id do evento ou do agregado. Com aspas ou vírgula, a busca fica só no tipo, no agregado e na origem, porque o padrão no payload seguiria para os campos seguintes e, letra a letra, revelaria o que a tela mascara. O histórico respeita a retenção da conta. Fuso e retenção vêm do repositório de configurações, a preferência gravada, e não do serviço de configurações, que chamava o Google a cada leitura quando a conta tem o Google conectado.
- **frontend (BFF):** rotas `/api/eventos`, `/api/eventos/historico` e `/api/eventos/[id]`. Componente novo `components/ui/paginacao.tsx` e o ícone `search` no `Icone`.

Motivo: a tela carregava todos os eventos de uma vez e filtrava no navegador, o que deixava a lista longa e lenta com centenas de eventos, e a pessoa pediu paginação e um layout mais diferenciado.

Como foi verificado: backend com 48 arquivos e 293 testes passando, com testes novos de evento, página, SQL e serviço. Agents com 21 testes passando. TypeScript limpo em contracts, backend, frontend e agents, e lint limpo nos arquivos novos. Pela API, contra os 444 eventos do Postgres local: 9 páginas, página 99 caindo na 9, filtros e contagens, busca com `%` e `_` escapados, busca com aspas sem tocar o payload, busca por começo de id ainda achando eventos e agregados, filtro de dia no fuso de Manaus, histórico com retenção de 1 ano, detalhe e 404. No Chrome, em 1440 e 375 px: paginação, status, aba, dia, limpar, busca, abrir evento, atualizar e troca para o histórico, sem erro nem aviso no console. Capturas de tela em 375, 760, 1100 e 1440 px, claro e escuro, sem rolagem horizontal. Docker local reconstruído e `localhost:3000/eventos` respondeu.

Limites conhecidos: logouts gravados antes desta mudança continuam como `encerrar-sessao` e aparecem como sessão de finanças; "falha" e "iniciado" no histórico ainda não têm registros, porque o consumidor só grava sucesso; a busca não ignora acento.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/eventos/eventos.controller.ts`
- `apps/backend/src/eventos/eventos.module.ts`
- `apps/backend/src/eventos/aplicacao/eventos.service.ts`
- `apps/backend/src/eventos/portas/eventos-repositorio.ts`
- `apps/backend/src/eventos/dominio/pagina.ts`
- `apps/backend/src/eventos/adaptadores/prisma-eventos-repositorio.ts`
- `apps/backend/src/eventos/adaptadores/sql-dos-eventos.ts`
- `apps/backend/src/eventos/dominio/evento.spec.ts`
- `apps/backend/src/eventos/dominio/pagina.spec.ts`
- `apps/backend/src/eventos/adaptadores/sql-dos-eventos.spec.ts`
- `apps/backend/src/eventos/aplicacao/eventos.service.spec.ts`
- `apps/backend/src/eventos/dominio/montar.spec.ts` (removido)
- `apps/backend/src/auth/adaptadores/prisma-auth-repositorio.ts`
- `apps/backend/src/auth/adaptadores/prisma-auth-repositorio.spec.ts`
- `apps/frontend/app/api/eventos`
- `apps/frontend/app/eventos/page.tsx`
- `apps/frontend/app/eventos/detalhe.tsx`
- `apps/frontend/app/eventos/ferramentas.tsx`
- `apps/frontend/app/eventos/formato.ts`
- `apps/frontend/app/eventos/leitura.ts`
- `apps/frontend/app/eventos/linha-do-tempo.tsx`
- `apps/frontend/app/eventos/status.tsx`
- `apps/frontend/app/eventos/url.ts`
- `apps/frontend/app/eventos/volume.tsx`
- `apps/frontend/components/ui/paginacao.tsx`
- `apps/frontend/components/ui/icone.tsx`
