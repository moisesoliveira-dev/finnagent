import { IonIcon } from "@ionic/react";
import { barChartOutline, cardOutline, chevronForward, documentTextOutline, flagOutline, folderOpenOutline, settingsOutline, timeOutline, todayOutline } from "ionicons/icons";
import { Link } from "react-router-dom";
import { Pagina } from "../componentes/Pagina";

const ATALHOS = [
  { para: "/inicio/hoje", icone: todayOutline, titulo: "Hoje", texto: "Tarefas, compromissos e vencimentos do dia" },
  { para: "/metas", icone: flagOutline, titulo: "Metas", texto: "O que você está juntando" },
  { para: "/financas/contas", icone: cardOutline, titulo: "Contas", texto: "Contas, cartões e caixinhas" },
  { para: "/financas/grupos", icone: folderOpenOutline, titulo: "Grupos e sessões", texto: "Onde cada lançamento entra" },
  { para: "/financas/relatorios", icone: barChartOutline, titulo: "Relatórios", texto: "O ano por mês e por categoria" },
  { para: "/extratos", icone: documentTextOutline, titulo: "Extratos", texto: "Importar e conferir" },
  { para: "/configuracoes/eventos", icone: timeOutline, titulo: "Eventos", texto: "O que o sistema processou" },
  { para: "/configuracoes", icone: settingsOutline, titulo: "Configurações", texto: "Preferências do aplicativo" },
];

/** O resto do Prumo: o que não cabe na barra de baixo. É a aba "Mais". */
export function Mais() {
  return (
    <Pagina titulo="Mais" etiqueta="O resto do Prumo">
      <div className="pagina">
        <div className="lista">
          {ATALHOS.map((atalho) => (
            <Link key={atalho.para} to={atalho.para} className="linha atalho-de-linha">
              <IonIcon icon={atalho.icone} aria-hidden />
              <span className="texto" style={{ flex: 1 }}>
                <strong>{atalho.titulo}</strong>
                <span className="etiqueta">{atalho.texto}</span>
              </span>
              <IonIcon icon={chevronForward} aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </Pagina>
  );
}
