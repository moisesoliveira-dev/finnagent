import { IonActionSheet, IonButton, IonIcon } from "@ionic/react";
import { ellipsisVertical } from "ionicons/icons";
import { useState } from "react";
import { toque } from "../haptico";

export type AcaoDoMenu = {
  texto: string;
  icone?: string;
  /** Apagar, cancelar, excluir: aparece em vermelho. */
  perigo?: boolean;
  /** Fica fora do menu quando for falso. */
  visivel?: boolean;
  aoEscolher: () => void;
};

/**
 * Os três pontos na vertical: guarda as ações secundárias de um item numa folha, para a tela mostrar só a principal.
 * Sem nenhuma ação visível, não desenha nada.
 */
export function MenuDeAcoes({
  acoes,
  titulo,
  rotulo = "Mais ações",
  desabilitado,
  tamanho = "small",
}: {
  acoes: AcaoDoMenu[];
  titulo?: string;
  rotulo?: string;
  desabilitado?: boolean;
  tamanho?: "small" | "default";
}) {
  const [aberto, setAberto] = useState(false);
  const visiveis = acoes.filter((acao) => acao.visivel !== false);
  if (visiveis.length === 0) return null;
  return (
    <>
      <IonButton
        size={tamanho}
        fill="clear"
        className="botao-de-menu"
        aria-label={rotulo}
        aria-haspopup="dialog"
        disabled={desabilitado}
        onClick={(evento) => {
          evento.stopPropagation();
          toque();
          setAberto(true);
        }}
      >
        <IonIcon slot="icon-only" icon={ellipsisVertical} />
      </IonButton>
      <IonActionSheet
        isOpen={aberto}
        header={titulo}
        buttons={[
          ...visiveis.map((acao) => ({
            text: acao.texto,
            icon: acao.icone,
            role: acao.perigo ? ("destructive" as const) : undefined,
            handler: () => {
              // A folha fecha antes de a ação abrir outra (alerta, formulário): sem isso, as duas disputam a tela.
              setTimeout(acao.aoEscolher, 0);
            },
          })),
          { text: "Cancelar", role: "cancel" as const },
        ]}
        onDidDismiss={() => setAberto(false)}
      />
    </>
  );
}
