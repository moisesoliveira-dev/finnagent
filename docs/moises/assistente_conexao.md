# Queda da conexão com o serviço de IA: nova tentativa e mensagem clara

## Queda da conexão com o serviço de IA: nova tentativa e mensagem clara

Ao reconstruir o ambiente local no meio de uma execução, a IA terminava com "Não consegui terminar: terminated", que é o erro cru do `fetch` quando a conexão com o agents cai no meio da resposta.

O que foi feito:

- Diagnóstico: as duas conversas com o erro em `ai_conversations` tinham a última escrita poucos segundos antes de os contêineres do backend e do agents serem recriados. O `Dockerfile` copia o repositório inteiro (`COPY . .`) e o frontend depende do backend, que depende do agents, então reconstruir o frontend recria os três. O serviço de IA já manda uma linha em branco a cada 10 s durante o passo, então o limite de 5 minutos sem dados do Node não era a causa.
- `motor-http.ts`: se a conexão com o agents cai antes de ele dizer qualquer coisa, o passo é tentado de novo, até duas vezes a mais, esperando 3 s e 8 s (tempo de o serviço voltar). É seguro porque o passo só pede as ferramentas, que o backend executa depois. Se algo já saiu para a pessoa (o texto começou), não repete, para não duplicar o que ela viu. Recusa do agents (400) e cancelamento pela pessoa não repetem.
- `erros.ts`: `ConexaoComOAgentsCaiu` (mensagem: "A conexão com o serviço de IA caiu no meio da resposta. Pode ter sido uma atualização do sistema. Tente de novo.") no lugar do "terminated", e `SemConexaoComOAgents` para o serviço parado ("O assistente não está disponível agora"). A causa real continua no log (`causa`).
- Testes: `motor-http.spec.ts`, com um servidor falso local (nada de provedor de IA): sem queda; queda antes da resposta e sucesso na segunda; queda sempre (3 tentativas, mensagem clara, sem "terminated"); queda depois do texto (não repete); 400 (não repete); serviço fora do ar.
- A tela e o app já tratam o fluxo cortado entre eles e o backend (acompanham a conversa até terminar); não mudaram.
- Fica para depois: tornar os Dockerfiles menos acoplados, para uma edição de tela não recriar o backend e o agents.

Motivo: a conexão com o agents caía no meio da resposta quando o ambiente era reconstruído, e a pessoa via só o erro cru "terminated".

Verificação: `tsc` limpo e 547 testes do backend passando; backend reconstruído sozinho (`--no-deps`) no Compose local, sem recriar agents nem frontend, depois de conferir que não havia IA em andamento. Não verificado: uma queda real no meio de uma execução da IA, porque isso exigiria chamar o provedor.

Atenção ao subir: nada.

Arquivos:

- `apps/backend/src/assistente/adaptadores/motor-http.ts`
- `apps/backend/src/assistente/adaptadores/motor-http.spec.ts` (novo)
- `apps/backend/src/assistente/dominio/erros.ts`
