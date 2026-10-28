# Importações

## Tela de Importações

O que foi feito: a tela de extratos ganhou área de soltar arquivo nova, barra de saúde e extratos em cartões.

- **Área de soltar:** cartão horizontal com ícone de upload e etiquetas OFX, CSV, Foto e PDF. Ao arrastar, o ícone sobe, o cartão cresce e o texto vira "Solte para importar".
- **Barra de saúde:** azul para linhas lidas sem erro, vermelho para com erro. Aparece no resumo e em cada extrato, crescendo da esquerda.
- **Cartões de extrato:** grade de 1, 2 e 3 colunas. Cada um tem o quadrado do formato, nome, conta, status, período, linhas, barra e rodapé com a data e as ações: Ver linhas e, só com ícone, Reprocessar e Excluir.
- **Conta:** virou abas com contagem, reaproveitando a peça `Abas` de `app/eventos/ferramentas.tsx`. Filtro de status e busca continuam.
- **Ícone:** novo `upload` em `components/ui/icone.tsx`.

Motivo: a tela era uma lista simples, e a pessoa pediu um layout que mostre a saúde de cada importação de relance.

Como foi verificado: tsc e eslint limpos; capturas em 1440, 760 e 375 px sem rolagem horizontal. Só havia um extrato real (Nubank, 165 linhas, 0 erros).

Limites conhecidos: usa `Abas` da tela de Eventos, então esta branch vem depois do merge de `tela_de_eventos`.

Arquivos:

- `apps/frontend/app/extratos/page.tsx`
- `apps/frontend/components/ui/icone.tsx`
