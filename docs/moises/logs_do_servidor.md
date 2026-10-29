# Logs do servidor

## Logs por pedido e logs do assistente no backend, no agents e no BFF

O que foi feito: o backend, o agents e o BFF passaram a deixar rastro das falhas e de cada pedido, para o Railway mostrar o que aconteceu quando o assistente trava.

- **Logs no backend:** o backend passou a usar Pino (`apps/backend/src/log.ts`), como a regra de tecnologias manda, com nível por `LOG_LEVEL` (variável que já existia; nenhuma variável nova). Uma linha JSON por pedido (`apps/backend/src/registrar-pedidos.ts`): método, rota sem query, status e tempo. 5xx sai como erro, 4xx como aviso e conexão que cai antes do fim como "pedido abandonado". Sem corpo e sem token. Na subida, "backend no ar".
- **Assistente (backend):** turno iniciado e encerrado (com tempo, passos e se ficou aguardando), cada passo do agents (agente, resultado, tempo e ferramentas pedidas), cada ferramenta (tempo; falha com o detalhe) e falhas que antes não deixavam rastro. O `catch` do turno engolia o erro e só o mostrava na conversa; agora registra mensagem e causa (timeout, conexão recusada). Também registra o agents recusando o passo, fechando a resposta sem o evento final ou inacessível, e a ferramenta sem resposta da própria API. O `console.error` do publicador do outbox e das migrations virou Pino.
- **Agents:** "passo recebido" (nº de mensagens, agente ativo e provedor:modelo de cada função, sem chave), "passo concluído" (tempo, resultado, ferramentas) e a falha do passo passou de aviso para erro, com a mensagem traduzida e um trecho do erro bruto do provedor.
- **Frontend (BFF):** `apps/frontend/app/api/_lib/registro.ts` escreve uma linha JSON no mesmo formato quando o backend não responde, demora demais, devolve 5xx ou recusa o stream. Cancelar na tela não conta como falha.

Motivo: em produção o assistente travou e o Railway não tinha nenhuma linha de erro para explicar; as falhas do turno eram engolidas e não havia log por pedido.

Como foi verificado: backend com 51 arquivos e 312 testes (novo `registrar-pedidos.spec.ts`), agents com 21; tipos e lint limpos. Docker reconstruído e conferido com uma mensagem real no assistente: pedido, turno, passo do agents (7,7 s), encerramento no backend e "passo recebido" e "passo concluído" no agents. Um corpo inválido saiu como "pedido recusado".

Limites conhecidos: o Railway só guarda os logs HTTP desde o último deploy e os de aplicação dos deploys anteriores já removidos não voltam, então o que travou ontem não pode ser reconstituído; o log do frontend só cobre falhas do BFF, não cada pedido; o BFF usa `console` e não Pino porque a regra de tecnologias só pede Pino no backend e no agents.

Arquivos:

- `apps/backend/src/log.ts`
- `apps/backend/src/registrar-pedidos.ts`
- `apps/backend/src/registrar-pedidos.spec.ts`
- `apps/backend/src/main.ts`
- `apps/backend/src/persistencia/outbox-publicador.ts`
- `apps/backend/src/persistencia/prisma.service.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.ts`
- `apps/backend/src/assistente/adaptadores/motor-http.ts`
- `apps/backend/src/assistente/adaptadores/executor-http.ts`
- `apps/agents/src/assistente/adaptadores/http.ts`
- `apps/frontend/app/api/_lib/registro.ts`
- `apps/frontend/app/api/_lib/backend.ts`
- `apps/backend/package.json` e `pnpm-lock.yaml` (dependência `pino`)
