# Celular e Conferência de parcelas

## App: Finanças por grupo, nome na Conferência e menus de três pontos

O que foi feito:

- **Finanças por grupo:** a lista do mês deixou de ser por dia. Cada grupo é um bloco recolhível, com o número de itens e o total, e as transações dentro (cada uma com o dia e a sessão). O de maior movimento vem primeiro; os compromissos ficam num bloco à parte, por último. O painel passou a mandar `groupName` e `sessionName` em cada lançamento (opcionais). O app deduz grupo e sessão do texto "Grupo · Sessão" quando o campo não vem, então funciona também com o backend antigo.
- **Nome na Conferência:** o app ganhou o campo "Nome do lançamento", já preenchido com o nome lembrado da linha, com as etiquetas dos nomes usados antes; o nome vai no lançamento, na série, no lote e em cada parte da divisão (campo "Nome desta parte"). O site já fazia isso.
- **Três pontos:** componente `MenuDeAcoes`, com a ação principal visível e as secundárias numa folha. Aplicado em: Metas (Separar visível; caixinha e excluir no menu), extratos importados (Ver linhas visível; só erros, reprocessar e excluir no menu), detalhe do lançamento (Editar visível; apagar no menu; suspender o mês visível e mudar o valor e cancelar o mês no menu; Pagar e Quitar visíveis e desfazer último e cancelar o restante no menu; cada ocorrência com Pagar visível e editar, cancelar e estornar no menu), detalhe da conta (conferir saldo visível; transferir e editar no menu), compromisso (marcar como feito visível; editar e apagar no menu) e ações da linha da Conferência (dividir e ignorar).

Motivo: telas com 3 a 5 botões por item ficavam poluídas; o nome da linha só existia no site; e o mês por dia espalhava o mesmo grupo em vários pontos.

Como foi verificado: 20 testes do app, teste novo no painel do backend; conferido no celular o Finanças por grupo (grupo Conta, 3 itens, total e transações) e o menu de três pontos de um extrato (abre com o nome e "Excluir o extrato", e fecha sem alterar nada). Não exercitados no aparelho: o campo de nome e os demais menus.

Arquivos:

- `packages/contracts/src/index.ts`, `apps/backend/src/painel/dominio/montar.spec.ts`
- `apps/mobile/src/componentes/MenuDeAcoes.tsx`, `apps/mobile/src/tema/tema.css`
- `apps/mobile/src/paginas/{Financas,Metas,Agenda}.tsx`
- `apps/mobile/src/paginas/extratos/{Conferencia,Importacoes}.tsx`
- `apps/mobile/src/paginas/financas/DetalheDoLancamento.tsx`, `apps/mobile/src/paginas/contas/DetalheDaConta.tsx`

## Conferência mais inteligente com parcelas

O que foi feito: a Conferência passou a saber qual parcela é cada linha, no site e no app.

- **Leitor da descrição (`parcelaDaDescricao`, em `packages/contracts`):** lê "Parcela 3/10", "PARC 03/10", "parcela 3 de 10", "03/24" (só quando o total passa de 12, para não confundir com data), "Parc 3" (só o número) e "em 10x" (só o total). Não confunde data (`03/11`), valor nem "Parcelamento da fatura".
- **Lançar uma parcela nova:** se o banco escreveu a parcela na linha de uma saída, o tipo já nasce como "Parcela", com o número e o total preenchidos, e a tela diz "Pelo extrato: parcela 3 de 10". Trocar o tipo para parcela na mão também preenche os números.
- **Cruzar com uma parcela que já existe:** cada candidato mostra a parcela do contrato que a linha vai pagar ("parcela 3/10") e a frase diz quais ("Paga a parcela 3 de 10", "Paga as parcelas 3 e 4 de 10"). Se o extrato diz uma parcela e o contrato está em outra, a tela avisa antes de confirmar.
- **Proposta e ordem dos candidatos:** a parcela escrita na linha vale mais que o valor para ordenar; quando um só contrato está nessa parcela e no mesmo valor, ele vira a proposta, mesmo longe do dia.
- **Série (a mesma compra em outros meses):** o número da parcela de cada mês vem do que o banco escreveu naquele mês, e não só da conta de meses a partir da origem; um mês pulado deixa de desencontrar os números.

Motivo: parcelas lançadas pela Conferência pediam o número e o total de memória, e a linha dizia só o valor.

Como foi verificado: 119 testes dos extratos no backend (novos: o leitor com formatos que devem e que não devem ser lidos, a ordem e a proposta por parcela, a parcela do candidato e os números da série); `tsc` do site e do app. Não exercitado com dados reais: o texto exato dos seus extratos pode ter formatos que o leitor não cobre.

Limites conhecidos: linha sem nenhuma marca de parcela no texto continua pedindo o número; se o banco escrever a parcela de um jeito novo, é só acrescentar o formato no leitor.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/src/extratos/dominio/{cruzar,serie}.ts` e os `.spec.ts`, `parcela-do-extrato.spec.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/frontend/app/extratos/conferencia/page.tsx`
- `apps/mobile/src/paginas/extratos/Conferencia.tsx`
