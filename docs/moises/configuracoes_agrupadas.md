# Perfil e configurações agrupados, com o tema escolhível no app

## Perfil e configurações agrupados, com o tema escolhível no app

Motivo: a auditoria de UX do celular mostrou configurações em lista plana, o perfil com quatro abas apertadas em 375 px e o app sem como trocar o tema, que só seguia o do celular.

O que foi feito (só no app Ionic):

- Tema (`tema/tema.ts`, `tema.css`): o app passa a respeitar a preferência `theme` (Automático, Claro, Escuro) que a conta já tinha e a web já usava. O CSS ganhou `:root[data-theme="dark"]` e o bloco do celular passou a valer só quando o tema não está fixado em claro (mesmo atributo `data-theme` da web); a roda de data também respeita a escolha. `aplicarTema` aplica e guarda a escolha no aparelho (`main.tsx` a aplica antes do primeiro quadro, sem piscar). `useTemaEscuro` faz o logo (`componentes/Simbolo.tsx`) trocar de versão junto. `tema/TemaDaConta.tsx` busca `/api/configuracoes` ao abrir o app e aplica o tema da conta em todas as telas, como a web já fazia, então quem escolheu o escuro no site, ou em outro aparelho, encontra o app escuro.
- Configurações (`paginas/Configuracoes.tsx`): a lista plana virou grupos com título (Conta, Aparência, Assistente, Finanças e agenda, Avisos, Dados) e o rodapé "Sobre" com a versão do app (lida de `package.json`). "Tema" é uma linha que mostra a escolha atual e abre uma folha com as três opções; ao tocar, o tema muda na hora e é gravado na conta (se o servidor recusar, volta ao anterior). O seletor de tema saiu da folha "Conta".
- Perfil (`paginas/Perfil.tsx`): as quatro abas segmentadas viraram linhas com ícone e seta (Dados do perfil, Avisos, Segurança, Sessões), cada uma abrindo a sua folha; o link `?aba=avisos` das notificações abre a folha de Avisos; a linha de dados mostra "Não salvo" quando há edição pendente. "Sair da conta" continua no fim.
- Limpeza: importações sem uso em Configuracoes (`ler`, `Fichas`).

Verificação: no app Ionic rodando no navegador (Vite, 375 px, sessão de teste), o perfil mostra as quatro linhas, sem abas segmentadas, e "Sair da conta" no fim; tocar em Segurança abre a folha e `?aba=avisos` abre a de Avisos; as configurações mostram os grupos e "Sobre", e a linha "Tema" mostra a escolha atual; Claro deixa o fundo claro mesmo com o sistema escuro, Escuro deixa escuro, a escolha é gravada na conta, sobrevive a reabrir o app, e o logo troca para a versão clara; um aparelho sem tema guardado abre já no tema da conta. O tema original da conta (escuro) foi restaurado no fim do teste. `tsc` limpo e 20 testes do app passando.

Não verificado: Automático acompanhando o tema do sistema depois de trocar na mesma sessão (o roteiro tocou em Automático antes de a tela carregar; o caminho `auto` remove o atributo e deixa o `prefers-color-scheme` valer), a barra de status do aparelho e aparelho físico.

Fora desta etapa: a web não mudou; as configurações dela já são uma página com seções. O app passa a seguir o tema escuro da conta, que antes ignorava.

Atenção ao subir: nada.

Arquivos:

- `apps/mobile/src/tema/tema.ts` (novo)
- `apps/mobile/src/tema/TemaDaConta.tsx` (novo)
- `apps/mobile/src/tema/tema.css`
- `apps/mobile/src/main.tsx`
- `apps/mobile/src/App.tsx`
- `apps/mobile/src/componentes/Simbolo.tsx`
- `apps/mobile/src/paginas/Configuracoes.tsx`
- `apps/mobile/src/paginas/Perfil.tsx`
