# Assistente de IA

## Chat com uma equipe de agentes que opera o sistema

O que foi feito: nova aba **Assistente** (`/assistente`), um chat no padrão dos assistentes conhecidos: histórico de conversas à esquerda, mensagens com o selo do especialista que respondeu, texto chegando aos poucos, ações feitas aparecendo como chips (girando, feita, falhou, cancelada), perguntas com opções em cartão, botão Parar, Nova conversa e sugestões na tela vazia. A IA faz no sistema o que a pessoa pedir, menos perfil, senha, usuários, configurações e exportar/importar.

Como funciona, em três partes:

- **agents** (LangGraph): um grafo com um **coordenador** e seis **especialistas** (Finanças, Agenda, Organização, Metas, Extratos e Análise). O coordenador faz a triagem só com texto; cada especialista recebe apenas as ferramentas dele, mais `perguntar` (pergunta com opções) e `encaminhar` (passa a vez a outro especialista, até 3 vezes por passo). O agents só raciocina: quando um especialista quer usar uma ferramenta, o passo termina e devolve as chamadas ao backend. Responde em NDJSON, com o texto saindo enquanto o modelo escreve.
- **backend** (`apps/backend/src/assistente`): orquestra o turno (saga por orquestração). Chama o agents, executa as ferramentas e chama de novo, até a resposta ou o limite de passos. A ferramenta é executada chamando **a própria API com o token da sessão** de quem conversa: passa pelo mesmo guarda, tenant, validação e outbox que a tela. O catálogo de ferramentas é a lista fechada do que a IA alcança; o que não está nele não existe para ela.
- **frontend**: a tela do chat e o BFF, que repassa o fluxo sem bufferizar (`streamBackend`) e leva o Parar até o modelo.

Garantias que estão no código, não só no prompt:

- Ação que apaga ou cancela (excluir, cancelar parcelas, fechar a virada do ano) para e pede confirmação com Confirmar/Cancelar; só executa depois do sim. Dá para desligar em Comportamento.
- Especialista que chama ferramenta de outro especialista, ou ferramenta fora do catálogo, recebe erro e nada é executado.
- O modelo nunca vê o token da sessão; o provedor simulado do teste confirmou que não recebe.
- Conversas são de cada usuário: a de outra pessoa responde 404.
- Uma pergunta pendente segura o turno; se a pessoa escrever outra coisa, a pergunta fica "Sem resposta" e o turno fecha.

Provedores: OpenAI, Anthropic, Google Gemini, qualquer API **compatível com OpenAI** (OpenRouter, Groq, Mistral, DeepSeek, Together, xAI...) e **Ollama**. Cada agente pode usar um modelo diferente; quem não tem modelo próprio usa o padrão. A leitura de extrato por foto ou PDF virou a função "Leitura de extratos" e, por enquanto, só funciona com provedores no formato da OpenAI. Na nuvem (Railway), a URL de provedor não pode ser http nem apontar para endereço interno, para o agents não virar porta para a rede privada.

Configurações: o grupo "Assistente e avisos" deu lugar a **Inteligência artificial**, com três seções: **Provedores** (cartões, testar conexão que lista os modelos, chave que nunca volta para a tela), **Agentes** (o mapa do ecossistema, com o coordenador em cima, a equipe embaixo e o modelo de cada um) e **Comportamento** (confirmar antes de apagar, passos por mensagem, estilo das respostas, instruções para o assistente, por quanto tempo guardar as conversas e apagar as próprias conversas). Todos da conta leem; só o master muda. O painel abre direto numa seção com `?secao=`.

Dados: tabelas `ai_providers`, `ai_settings`, `ai_conversations` e `ai_messages`. A migration leva a chave e os modelos da OpenAI que estavam nas preferências para um provedor, e o modelo escolhido vira o padrão, para a leitura de extratos de quem já usava continuar funcionando. As colunas antigas das preferências ficam como reserva da leitura de extrato. Eventos no outbox, na mesma transação, com ids e contagens, sem chave e sem o texto da conversa: `criar-provedor-de-ia`, `atualizar-provedor-de-ia`, `remover-provedor-de-ia`, `salvar-assistente-de-ia`, `criar-conversa`, `registrar-mensagem-do-assistente`, `renomear-conversa`, `remover-conversa`, `remover-conversas` e `expirar-conversas`.

Interface: a navegação (`AppShell`) e a ordem das abas (`movimento.tsx`) ganharam `/assistente`, logo depois do Dashboard. O ícone de ação em andamento tem saída com transição própria: herdando o giro infinito, a saída nunca terminaria e o ✓ não entraria.

Motivo: a pessoa quer pedir em português e ver o sistema ser operado por ela, com mais de um provedor de IA e sem um agente único fazendo tudo.

Como foi verificado: testes do agents (grafo com modelo de roteiro, conversão de mensagens, URLs) e do backend (orquestrador, executor contra um servidor HTTP real, configuração de IA). De ponta a ponta, com um provedor simulado no formato da OpenAI: em desenvolvimento e em produção com login, criar meta, apagar com confirmação, pergunta com opções seguida de lançamento, membro barrado nas configurações e conversa de outro usuário bloqueada, conferindo o banco e o outbox.

Limites conhecidos: as chaves dos provedores ficam no banco sem criptografia, como as outras chaves do sistema; o resultado de uma ferramenta é cortado em 12 mil caracteres antes de ir ao modelo; importar extrato novo continua só pela tela; não testado com chave real de nenhum provedor.

Arquivos:

- `packages/contracts/package.json`
- `packages/contracts/src/index.ts`
- `apps/agents/package.json`
- `apps/agents/src/main.ts`
- `apps/agents/src/assistente`
- `apps/agents/src/extratos/adaptadores`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261029090000_assistente_de_ia`
- `apps/backend/src/assistente`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/auth/auth.module.ts`
- `apps/backend/src/extratos/extratos.module.ts`
- `apps/backend/src/extratos/aplicacao/extratos.service.ts`
- `apps/frontend/app/assistente`
- `apps/frontend/app/api/assistente`
- `apps/frontend/app/api/ia`
- `apps/frontend/app/api/_lib/backend.ts`
- `apps/frontend/app/configuracoes/ia`
- `apps/frontend/app/configuracoes/painel.tsx`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/components/ui/movimento.tsx`
- `pnpm-lock.yaml`
