# Contas: layout

## Redesenho da tela de Contas

O gráfico do patrimônio estava grande, e a pessoa não gostou de como importações, caixinhas e o resto apareciam. A referência foi a tela de contas de apps como Copilot Money, Monarch e Nubank. Só o frontend mudou; backend e contratos ficaram como estavam.

O que foi feito:

- `BarrasCompactas` (`components/ui/barras.tsx`): versão baixa do gráfico, com cerca de 96 px, barras finas, sem moldura nem eixo. Ao apontar, focar ou tocar, o mês e o valor aparecem numa linha. O `Barras` original não mudou, e o Dashboard continua usando ele.
- `BarraDeUso` (`components/ui/barra-de-uso.tsx`, novo): barra fina com `role="meter"` e os tons brand, pos, pending e neg. Aparece no limite do cartão e no progresso da meta.
- Patrimônio (`patrimonio.tsx`): cabeçalho compacto com o patrimônio em destaque, a variação desde o fim do mês anterior e a linha Contas · Caixinhas · Cartões. No desktop o gráfico pequeno fica ao lado; no celular, abaixo.
- Lista (`page.tsx`): agrupada em "Contas" e "Cartões". A conta mostra "N caixinhas · R$ X guardado". O cartão mostra "Fatura de <mês> · vence dd/mm" e a barra do limite. A selecionada leva brand-soft e borda à esquerda.
- Detalhe (`page.tsx`): nome, tipo, saldo inicial em texto pequeno, os números principais e os botões. Só Conferir saldo é amarelo. As abas usam `Segmentado`: Movimentos (padrão), Caixinhas (só na conta), Faturas (só no cartão) e Extratos, animadas com `Troca`. Se a aba aberta não existe para o tipo selecionado, a tela volta para Movimentos. Diálogos e ações continuam iguais.
- Caixinhas (`caixinhas.tsx`): cartões numa grade, com 1 coluna no celular e 2 a partir de 760 px. Cada cartão traz o chip da meta, o saldo em destaque, o rendimento do mês e o total, e a barra de progresso da meta. "Lançar rendimento" fica à vista; "Mais" abre Informar saldo, Aplicar, Resgatar e Editar.
- Faturas (`faturas.tsx`): barra de uso do limite, que fica pending a partir de 80% e neg a partir de 100%. A fatura atual aparece em destaque e as anteriores numa lista compacta. Mês sem compras e com total zero fica escondido, exceto o atual.
- Comece por aqui (`comece.tsx`): faixa mais enxuta, com quatro passos numerados: 4 colunas no desktop, 2 no tablet e 1 no celular.

Motivo: o gráfico ocupava espaço demais e a tela não organizava bem contas, cartões, caixinhas e faturas.

Verificação: tsc e eslint de `app/contas` e `components/ui` limpos; frontend reconstruído no Docker, e `/contas` responde 200. Fotos em 375, 760 e 1280 px no tema escuro e em 375 e 1280 px no claro, nas abas Movimentos, Caixinhas e Faturas, sem rolagem horizontal. Os dados de teste foram apagados. Não fotografado: 1100 e 1440 px, a aba Extratos e o "Comece por aqui", que só aparece sem conta ou sem extrato.

Observação: um título h1–h3 com a classe `etiqueta` perde o estilo, porque o `globals.css` estiliza os títulos fora das camadas. Nas telas de Contas, a solução foi pôr um `span` com `etiqueta` dentro do título. Outros seis lugares do repositório têm o mesmo problema e ficaram como estavam.

Atenção ao subir: nada (só frontend).

Arquivos:

- `apps/frontend/components/ui/barras.tsx`
- `apps/frontend/components/ui/barra-de-uso.tsx` (novo)
- `apps/frontend/app/contas/` (`patrimonio.tsx`, `page.tsx`, `caixinhas.tsx`, `faturas.tsx`, `comece.tsx`)

## Acertos antes de subir: app de Contas e correções do web

O que foi feito:

- App, cartão: o botão virou "Conferir fatura" e a folha pede "Fatura em aberto", gravada sempre negativa. O interruptor "Saldo negativo" saiu, porque desligá-lo gravava a fatura como saldo positivo.
- App, caixinha: ganhou "Editar" e a meta na criação, com o formulário `FormDaCaixinha` (nome, saldo inicial, "Saldo em", meta) e `PATCH /api/caixinhas/:id`. O card da caixinha ligada a uma meta mostra a meta e a barra de progresso.
- App, lista: agrupada em "Contas" e "Cartões". O cartão mostra a próxima fatura e a barra do limite.
- App, detalhe do cartão: barra de uso do limite, a fatura atual em destaque e as anteriores em lista.
- App: componente novo `BarraDeUso` e estilos em `tema.css`, que também traz os estilos do checklist usados na Agenda do app.
- Backend: o painel (`/api/painel`) passou a listar entre os itens do mês o lançamento da sobra levada (sessão Sobras); os totais continuam só com o mês. Antes, o app, que monta a lista de Finanças pelo painel, não mostrava a "Falta de outubro".
- Web, Contas: o saldo não some mais com nome longo (`shrink-0`).
- Web, Conferência: no celular, os filtros ocupam a largura toda e a página não rola mais para o lado.

Motivo: uma auditoria antes de subir a versão achou diferenças entre o web e o app e dois defeitos de layout no celular.

Verificação: tsc, vitest e vite build do app passando. Os corpos das APIs do app foram testados pelo BFF (caixinha com meta criada e editada); os dados de teste foram apagados. Fotos do app em 375 px. No web, Conferência, Contas, Finanças, Hoje e Agenda medidas em 375 px sem rolagem horizontal. O painel de novembro trouxe 1 item de sobra na lista, com a sobra do mês −2.316,70 e a acumulada −14.088,85.

Pendente (refinamento): no app, o gráfico do patrimônio, as abas no detalhe da conta e o "Comece por aqui".

Arquivos:

- `apps/mobile/src/paginas/Contas.tsx`
- `apps/mobile/src/paginas/contas/AcoesDaConta.tsx`
- `apps/mobile/src/paginas/contas/DetalheDaConta.tsx`
- `apps/mobile/src/componentes/BarraDeUso.tsx` (novo)
- `apps/mobile/src/tema/tema.css`
- `apps/backend/src/painel/aplicacao/painel.service.ts`
- `apps/frontend/app/contas/page.tsx`
- `apps/frontend/app/extratos/conferencia/page.tsx`
