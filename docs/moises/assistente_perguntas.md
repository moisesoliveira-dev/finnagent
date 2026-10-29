# Assistente: perguntas e conexão

## Aviso quando a resposta é cortada

O que foi feito: o chat avisa quando o fluxo da resposta termina sem o evento `fim` e recarrega a conversa com o que o servidor guardou.

Motivo: no servidor, a conexão caía no meio do turno e a tela ficava parada, sem aviso, com a resposta pela metade.

Limites conhecidos: a causa do corte no Railway não foi identificada; o aviso só deixa de esconder a falha.

## Sinal de vida e log de conexão cortada

O que foi feito: o backend e o agents escrevem uma linha em branco no NDJSON a cada 10 s, que os leitores já ignoram. Os dois também registram em log (`warn`) quando a conexão fecha antes do fim e o turno é interrompido, com o tempo decorrido.

Motivo: no log da OpenAI o `encaminhar` terminou e a chamada seguinte nunca saiu; durante o raciocínio do modelo e as ferramentas não passa nenhum byte, e a conexão pode ser cortada por ociosidade.

Limites conhecidos: é uma hipótese; se o corte continuar, o log novo mostra em que ponto da cadeia e depois de quanto tempo ele ocorre.

Arquivos:

- `apps/backend/src/assistente/assistente.controller.ts`
- `apps/agents/src/assistente/adaptadores/http.ts`

Arquivos:

- `apps/frontend/app/assistente/chat.tsx`

## Sem botão genérico de "outra resposta"

O que foi feito: o prompt proíbe opções como "Outra resposta", "Outra regra" e "Escolher outro nome". O backend descarta essas opções se o modelo mandar mesmo assim e recusa a pergunta que ficar com menos de 2 opções.

Motivo: a tela já tem o campo "Outra resposta"; o botão genérico mandava só o rótulo e o modelo não sabia o que a pessoa queria.

Como foi verificado: testes do backend e do agents passando, com spec novo para o filtro.

Arquivos:

- `apps/agents/src/assistente/dominio/prompts.ts`
- `apps/backend/src/assistente/dominio/opcoes.ts`
- `apps/backend/src/assistente/dominio/opcoes.spec.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.ts`

## Turno que sobrevive à conexão

O que foi feito: o turno do assistente deixa de ser abortado quando a conexão do navegador cai. Ele termina no servidor e grava o resultado. "Parar" passou a ser um endpoint (`POST assistente/conversas/:id/parar`), e a conversa informa `emAndamento`. Um segundo turno na mesma conversa é recusado enquanto o primeiro roda. Na tela, se o stream acaba sem o `fim`, ela avisa e acompanha a conversa a cada 2,5 s até o servidor terminar, em vez de mostrar um turno pela metade.

Motivo: o servidor é lento, a conexão cai no meio e o turno morria junto, deixando a conversa parada e sem resposta.

Limites conhecidos: os turnos em andamento ficam na memória do backend (uma réplica por serviço); se o serviço reiniciar no meio, o turno se perde e a tela avisa para enviar de novo. A tela acompanha por até 6 minutos.

Arquivos:

- `apps/backend/src/assistente/aplicacao/assistente.service.ts`
- `apps/backend/src/assistente/aplicacao/assistente.service.spec.ts`
- `apps/backend/src/assistente/assistente.controller.ts`
- `packages/contracts/src/index.ts`
- `apps/frontend/app/assistente/chat.tsx`
- `apps/frontend/app/api/assistente/conversas/[id]/parar/route.ts`
