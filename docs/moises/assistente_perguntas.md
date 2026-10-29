# Assistente: perguntas e conexão

## Aviso quando a resposta é cortada

O que foi feito: o chat avisa quando o fluxo da resposta termina sem o evento `fim` e recarrega a conversa com o que o servidor guardou.

Motivo: no servidor, a conexão caía no meio do turno e a tela ficava parada, sem aviso, com a resposta pela metade.

Limites conhecidos: a causa do corte no Railway não foi identificada; o aviso só deixa de esconder a falha.

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
