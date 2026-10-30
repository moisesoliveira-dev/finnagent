# Notificações

## Sistema de notificações (web e mobile)

O que foi feito: sistema de avisos para web e mobile, com três canais e eventos gerados pelo backend.

Motivo: a pessoa ser avisada do que importa (vencimentos, extratos, metas, plano do assistente) sem precisar abrir o app.

- **Canais:** central no app (sino com contador), push do navegador (Web Push com VAPID, service worker `apps/frontend/public/sw-notificacoes.js`) e push do celular (Firebase Cloud Messaging HTTP v1, chamado direto do backend; `@capacitor/push-notifications` no mobile).
- **Eventos:** vencimentos; lembretes; extratos (leitura de imagem/PDF e linhas sem lançamento); metas (alcançada, prazo e parte do mês sem separar, a partir do dia 20); assistente (plano parado há mais de 10 minutos).
- **Preferências:** por usuário, por tipo e por canal, mais horário de silêncio.

### Backend (`apps/backend`)

- **Slice `src/notificacoes`:** `dominio/avisos.ts`, portas, adaptadores (Prisma, web-push, Firebase, agendador), aplicação (`notificacoes.service` e `varredura.service`), controller e module.
- **Banco:** migração `prisma/migrations/20261030120000_notificacoes` com as tabelas `notifications`, `notification_settings` e `push_devices`, todas com `tenant_id`. A chave de idempotência é tenant, usuário e fato. `schema.prisma` atualizado.
- **Outbox (`src/persistencia`):** novo `consumidores-do-outbox.ts` (`ConsumidoresDoOutbox`): o worker do outbox chama consumidores por operação. Jobs com 5 tentativas e backoff exponencial. O worker passa a subir em `onApplicationBootstrap`. Ajustes em `outbox-publicador.ts` e `persistencia.module.ts`.
- **Varredura:** job repetível do BullMQ a cada 5 minutos.
- **Outras slices:** `AuthService.listarTenants` (auth) e `AssistenteService.planosEsperando` (assistente); `MetasService` e `AssistenteService` passam a ser exportados pelos módulos (`metas.module.ts`, `assistente.module.ts`). `app.module.ts` registra o módulo novo.
- **Zerar dados (`src/dados/dominio/zerar.ts`):** apaga as notificações e mantém preferências e aparelhos.
- **Dependência:** `web-push` em `apps/backend/package.json`.

### Contracts (`packages/contracts/src/index.ts`)

Tipos e esquemas de notificação, `preferenciasDeNotificacaoDe`, `emSilencio`, `rotaWebDoDestino` e `ANTECEDENCIA_MS` exportado. As operações novas são categorizadas como `conta`.

### Frontend (`apps/frontend`)

- Rotas `app/api/notificacoes/*`.
- `components/notificacoes` (`SinoDoMenu`, a central e `push-do-navegador`), ligados em `components/ui/app-shell.tsx` e `components/auth/conta-do-menu.tsx`; Sair cancela o push do navegador.
- Seção em Configurações: `app/configuracoes/notificacoes.tsx`, usada em `painel.tsx`.
- `components/ui/interruptor.tsx` extraído para reuso; ícone de sino em `components/ui/icone.tsx`.
- `next.config.ts` com os cabeçalhos do service worker.

### Mobile (`apps/mobile`)

- Sino em toda tela (`componentes/Pagina.tsx`), página `/notificacoes` (`paginas/Notificacoes.tsx`) e aba Avisos no Perfil (`paginas/perfil/AbaAvisos.tsx`, `paginas/Perfil.tsx`).
- `src/notificacoes` (`push.ts`, `contagem.ts`, `destino.ts`). O toque na notificação abre a tela do destino (o assistente por `?c=`). O push é cancelado ao sair.
- `capacitor.config.ts` com `PushNotifications`; `App.tsx` e `tema/tema.css` ajustados; `Assistente.tsx` lê `?c=`.
- Dependência: `@capacitor/push-notifications` em `package.json` (e `pnpm-lock.yaml`).

### Variáveis novas (backend)

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e `FIREBASE_SERVICE_ACCOUNT`, já em `hospedagem.md`, `.env.example` e `compose.yaml`.

### Verificado

- `tsc` dos três apps, 352 testes no backend e build do mobile.
- Na tela, com backend e frontend rodando fora do Docker contra o Postgres e o Redis do Compose: sino com contador, central, marcar como lida, preferências salvando, ativação do push do navegador, push real aceito pelo FCM (201) e mobile em 390 px com tema claro e escuro.

### Não verificado

- Rebuild do Docker: o `pnpm install` dentro do container travou por falha de rede do container ao npm; o ambiente Docker segue com a imagem anterior.
- Push do celular em aparelho: os projetos nativos e o Firebase ainda não existem.
- Entrega do push do navegador com a aba realmente fechada.
- Lembretes e plano parado em dados reais.

## Componentes do mobile

O app mobile passa a usar componentes do Ionic no lugar de elementos nativos, com o estilo do web: tokens do app, sem sombra, cantos retos. Motivo: os controles nativos do sistema ignoravam as cores do app e ficavam ilegíveis no tema escuro.

### O que foi feito

- `Selecao.tsx`: o `<select>` nativo virou um botão que abre uma folha `IonModal` (`IonHeader`/`IonContent`) com a lista de opções. O texto longo quebra de linha e a opção atual fica marcada. O `IonSelect` foi tentado, mas o `ion-item` interno corta o texto com reticências dentro do Shadow DOM; por isso a folha é montada com `IonModal` e botões.
- `Campo.tsx`: `Campo` e `CampoDeSenha` usam `IonInput` (props `aoEnter` e `campoRef`). O novo `AreaDeTexto` usa `IonTextarea`. O `Login.tsx` usa esses mesmos componentes.
- `Hora.tsx` (novo): horário em folha `IonModal` com `IonDatetime` em `presentation="time"`, usado no horário de silêncio de `AbaAvisos`.
- `Conferencia.tsx`: os radios do valor do mês viraram `IonRadioGroup`/`IonRadio`.
- `Assistente.tsx` e `assistente/Mensagem.tsx`: o compositor e o campo de ajuste do plano usam `IonTextarea` com `autoGrow`.
- `tema/tema.css`: estilos de `ion-input`, `ion-textarea`, `ion-radio`, da folha de seleção, da roda de horas e da altura de uma linha do compositor (o textarea do Ionic tem `min-height` de 72px no `md`).

Ficam nativos de propósito: o seletor de arquivo da importação (sem equivalente no Ionic) e as fichas de canal em Avisos (botões de alternância com `aria-pressed`).

### Arquivos tocados

`apps/mobile/src/componentes/Selecao.tsx`, `Campo.tsx`, `Hora.tsx`, `apps/mobile/src/paginas/Login.tsx`, `paginas/perfil/AbaAvisos.tsx`, `paginas/extratos/Conferencia.tsx`, `paginas/Assistente.tsx`, `apps/mobile/src/assistente/Mensagem.tsx`, `apps/mobile/src/tema/tema.css`.

### Verificado

- Em 390 px, nos temas claro e escuro: Login, Perfil, horário de silêncio, radios da Conferência, lista de lançamentos e compositor.
- `tsc`, 2 testes e build do mobile passam.

### Não verificado

- Aparelho real: teclado virtual e roda de horas no iOS.
