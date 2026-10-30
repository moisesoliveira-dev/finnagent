import { IonButton, IonIcon, IonSkeletonText } from "@ionic/react";
import { motion } from "motion/react";
import { cloudOfflineOutline } from "ionicons/icons";
import { reais } from "../api/formato";
import { Contagem, toqueDoDedo } from "../movimento";

/** O esqueleto no lugar do conteúdo: a tela já mostra a forma do que vem, em vez de um círculo girando. */
export function Esqueleto({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="pagina" role="status" aria-label="Carregando">
      <div className="cartao">
        <IonSkeletonText animated style={{ width: "40%", height: 12 }} />
        <IonSkeletonText animated style={{ width: "70%", height: 40 }} />
        <div className="grade">
          <IonSkeletonText animated style={{ height: 36 }} />
          <IonSkeletonText animated style={{ height: 36 }} />
        </div>
      </div>
      <div className="lista">
        {Array.from({ length: linhas }, (_, indice) => (
          <div key={indice} className="linha">
            <div className="texto" style={{ flex: 1 }}>
              <IonSkeletonText animated style={{ width: `${60 - indice * 8}%`, height: 14 }} />
              <IonSkeletonText animated style={{ width: "30%", height: 10 }} />
            </div>
            <IonSkeletonText animated style={{ width: 72, height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Carregando na primeira vez, ou o erro com o botão de tentar de novo. Quem já tem dados não troca a tela por isso. */
export function Estado({
  carregando,
  erro,
  tem,
  aoTentar,
}: {
  carregando: boolean;
  erro: string;
  tem: boolean;
  aoTentar: () => void;
}) {
  if (tem) return erro ? <p className="erro">{erro}</p> : null;
  if (carregando) return <Esqueleto />;
  if (!erro) return null;
  return (
    <motion.div className="vazio" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <IonIcon icon={cloudOfflineOutline} aria-hidden />
      <strong>Não deu para carregar</strong>
      <span className="fraco">{erro}</span>
      <motion.div whileTap={toqueDoDedo}>
        <IonButton fill="outline" onClick={aoTentar}>
          Tentar de novo
        </IonButton>
      </motion.div>
    </motion.div>
  );
}

/** Quando não há nada para mostrar: diz o que fazer em seguida, em vez de uma tela muda. */
export function Vazio({ icone, titulo, texto, children }: { icone: string; titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <motion.div className="vazio" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
      {/* O ícone cai no lugar, como o peso de um prumo. */}
      <motion.span
        style={{ display: "inline-flex" }}
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
      >
        <IonIcon icon={icone} aria-hidden />
      </motion.span>
      <strong>{titulo}</strong>
      <span className="fraco">{texto}</span>
      {children}
    </motion.div>
  );
}

/** Dinheiro com sinal e cor: entrada em verde, saída em vermelho. */
export function Dinheiro({ cents, forte, animado }: { cents: number; forte?: boolean; animado?: boolean }) {
  const classe = `${cents < 0 ? "neg" : cents > 0 ? "pos" : ""}${forte ? " numero" : ""}`;
  return animado ? <Contagem valor={cents} formatar={reais} className={classe} /> : <span className={classe}>{reais(cents)}</span>;
}
