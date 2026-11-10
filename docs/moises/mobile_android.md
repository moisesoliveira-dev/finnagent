# Mobile: projeto Android

## Projeto Android e ícones gerados

O que foi feito: rodado `cap add android`, que criou `apps/mobile/android/`, e `pnpm --filter mobile assets`, que gerou os ícones e o splash do Android a partir das imagens de `apps/mobile/assets/`. Os arquivos de PWA que o gerador cria junto (`icons/`, `manifest.webmanifest`) foram removidos, porque o app não os usa.

Motivo: sem a pasta `android/` não há como compilar o app para o celular.

Como foi verificado: `tsc`, 12 testes e `vite build` do mobile passando; 24 ícones e 26 splashes gerados em `android/`. O APK ainda não foi compilado: falta o JDK 21 neste computador e o endereço público do frontend (`VITE_API_URL`).

Limites conhecidos: push no Android pede um `google-services.json` do Firebase em `android/app/`; sem ele o app compila e roda, mas não ligue as notificações no aparelho. O `sharp` usado pelo gerador de ícones (0.32.6) precisou ser compilado à mão, porque o pnpm bloqueia o script de instalação dele.

Arquivos:

- `apps/mobile/android/`

## O que faltava do web no celular

O que foi feito: o app passou a fazer o que o web faz, reorganizado para o celular.

- **Finanças:** botão + para lançar; tocar no lançamento abre o detalhe com editar, apagar, ocorrências (pagar, cancelar, estornar, desfazer), no Fixo suspender ou cancelar o mês e mudar o valor, e na parcela e no empréstimo pagar, quitar, desfazer o último pagamento e cancelar o restante. O formulário segue as regras da categoria (parcelas, empréstimo, recorrência, vencimento em dia útil, conta). Atalhos para Grupos e sessões e para Relatórios.
- **Grupos e sessões:** tela nova, com criar, editar, mover de grupo e excluir, e a revisão da virada do ano quando pendente.
- **Relatórios:** tela nova, o ano por mês, por grupo e por categoria.
- **Agenda:** criar, editar, marcar como feito, mudar o dia e apagar compromisso; sincronizar com o Google quando conectado.
- **Contas:** conferir o saldo (ajuste), transferir, pagar a fatura (também antecipado), editar e excluir a conta, e criar, movimentar, conferir e excluir caixinha.
- **Metas:** criar, separar, dividir a sobra, reordenar, ligar a caixinha e excluir. O cartão de cima mostra a sobra deste mês e a que veio dos meses anteriores, que juntas dão a sobra para as metas.
- **Conferência:** ignorar e reativar (filtro Ignoradas), marcar como transferência entre contas, dividir a linha em partes, lançar como parcela, empréstimo ou recorrente, e juntar a mesma compra de outros meses (séries).
- **Hoje:** editar a tarefa, mudar o dia, a repetição e o nível (subatividade), subir e descer.
- **Configurações (pelo Perfil):** conta, finanças e vencimentos, feriados (com os locais), Google Agenda, lembretes, usuários, eventos e dados (importar, desfazer a conferência, recomeçar); página de Inteligência artificial (provedores com teste, modelos, comportamento); tela de Eventos com o histórico.
- **Layout:** o valor da Conferência não encosta mais na seta e o selo não quebra em duas linhas; com o teclado aberto, o login mostra só o formulário.
- **Peças novas:** `Folha`, `useAcao` (ação com aviso e confirmação), `centavosDe`, `paraCampo` e `hojeIso` em `api/formato.ts`, com teste.

Motivo: a regra da interface pede que o que existe no desktop exista no celular.

Como foi verificado: `tsc`, 13 testes e `vite build` do mobile; APK gerado. As telas novas ainda não foram vistas no aparelho.

Limites conhecidos: conectar o Google e exportar os dados continuam só pelo site (a autorização do Google volta para o site, e o webview não salva o download). Na série, o mês com várias linhas sempre soma todas; o web também permite ficar com uma só. A visão geral do ano de Finanças do web não veio; o Início e Relatórios cobrem o ano.

Arquivos:

- `apps/mobile/src/App.tsx`, `apps/mobile/src/useAcao.ts`, `apps/mobile/src/api/formato.ts`, `apps/mobile/src/api/formato.spec.ts`, `apps/mobile/src/componentes/Folha.tsx`, `apps/mobile/src/componentes/Campo.tsx`, `apps/mobile/src/tema/tema.css`
- `apps/mobile/src/paginas/{Financas,Agenda,Hoje,Metas,Perfil,Grupos,Relatorios,Eventos,Configuracoes}.tsx`
- `apps/mobile/src/paginas/financas/`, `apps/mobile/src/paginas/agenda/`, `apps/mobile/src/paginas/configuracoes/`
- `apps/mobile/src/paginas/contas/{DetalheDaConta,AcoesDaConta}.tsx`, `apps/mobile/src/paginas/extratos/{Conferencia,Serie}.tsx`
