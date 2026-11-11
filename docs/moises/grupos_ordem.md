# Grupos: ordem escolhida pela pessoa

## Grupos e sessões na ordem que a pessoa escolher

A pessoa quer segurar e arrastar grupos e sessões para organizá-los, no celular com o dedo e na web com o mouse.

O que foi feito:

- Banco: colunas `position` em `groups` e `sessions`. A migração é `20261111090000_ordem_de_grupos_e_sessoes`, que numera pelo nome o que já existe; as sessões são numeradas dentro do grupo. A listagem passa a ordenar por posição e depois por nome. Grupo novo e sessão nova (ou que muda de grupo) entram no fim.
- Rotas: `PUT grupos/ordem` (todos os ids dos grupos) e `PUT sessoes/ordem` (`groupId` e todos os ids das sessões do grupo, ativas e encerradas). Recusam lista que não bate com o que existe. Gravam o evento `reordenar-grupos` ou `reordenar-sessoes` no outbox, na mesma transação. As rotas do BFF ficam em `apps/frontend/app/api/grupos/ordem` e `apps/frontend/app/api/sessoes/ordem`.
- Web: `components/ui/ordenavel.tsx`, com lista e item ordenáveis usando `Reorder` do motion e uma alça `⠿`. Só a alça arrasta, então a página continua rolando no celular. As setas do teclado na alça movem uma posição. Na página de Grupos, vale para os grupos e para as sessões dentro de cada grupo. A ordem fica desligada enquanto há busca. Editar mantém o lugar; antes o estado reordenava por nome.
- Mobile: `componentes/Ordenavel.tsx`, com a mesma ideia, toque háptico e alça de 44 px. A tela de Grupos fica reorganizável; as sessões encerradas ficam no fim do grupo, fora da ordem. Estilos `.alca` e `.linha-conteudo` em `tema/tema.css`.
- IA: ferramentas `organizar_grupos` e `organizar_sessoes_do_grupo` e menção no prompt.
- Testes: no serviço, lista completa, lista diferente e grupo ausente.

Motivo: a pessoa quer segurar e arrastar grupos e sessões para organizá-los, no celular com o dedo e na web com o mouse.

Verificação: no Compose local, a migração foi aplicada, as duas rotas funcionaram pelo BFF (200 e 400 com lista incompleta), o arraste real com o mouse em 1100 px foi persistido, e em 375 px não há rolagem horizontal. Não testado em aparelho físico com toque.

Atenção ao subir: a migração roda sozinha.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261111090000_ordem_de_grupos_e_sessoes/` (novo)
- `apps/backend/src/grupos/` (`grupos.controller.ts`, `aplicacao/grupos.service.ts` e o spec, `adaptadores/prisma-grupos-repositorio.ts`, `portas/grupos-repositorio.ts`)
- `apps/backend/src/assistente/adaptadores/rotas-das-ferramentas.ts`
- `packages/contracts/src/index.ts`
- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/frontend/components/ui/ordenavel.tsx` (novo)
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/api/grupos/ordem/route.ts` (novo)
- `apps/frontend/app/api/sessoes/ordem/route.ts` (novo)
- `apps/mobile/src/componentes/Ordenavel.tsx` (novo)
- `apps/mobile/src/paginas/Grupos.tsx`
- `apps/mobile/src/tema/tema.css`
