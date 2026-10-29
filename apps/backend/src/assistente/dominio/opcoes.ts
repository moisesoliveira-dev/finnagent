import type { PerguntaDoAssistente } from "@finnagent/contracts";

const OPCAO_GENERICA = /^(escolher |informar |digitar |escrever |dizer )?outr[ao]s?( resposta| opção| opcao| regra| nome| valor)?$/i;

/**
 * A tela já tem o campo "Outra resposta". Um botão genérico como "Outra regra" só mandaria o rótulo,
 * sem dizer qual é a regra, então ele sai da lista antes de chegar à pessoa.
 */
export function semOpcaoGenerica(opcoes: PerguntaDoAssistente["opcoes"]) {
  return opcoes.filter((opcao) => !OPCAO_GENERICA.test(opcao.rotulo.trim()));
}
