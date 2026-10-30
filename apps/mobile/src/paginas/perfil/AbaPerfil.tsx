import { IonButton } from "@ionic/react";
import { LIMITES_DO_PERFIL, TONS_DO_AVATAR, type PerfilDoUsuario } from "@finnagent/contracts";
import { briefcaseOutline, locationOutline, mailOutline, personOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { Avatar, ROTULO_DO_TOM } from "../../componentes/Avatar";
import { Campo } from "../../componentes/Campo";
import { toque } from "../../haptico";
import { curvaCheia, mola, toqueDoDedo } from "../../movimento";

export type DadosDoPerfil = Pick<PerfilDoUsuario, "name" | "headline" | "location" | "bio" | "avatarTone">;

export function AbaPerfil({
  rascunho,
  email,
  somenteLeitura,
  alterado,
  salvando,
  erro,
  aoMudar,
  aoSalvar,
  aoDescartar,
}: {
  rascunho: DadosDoPerfil;
  email: string;
  somenteLeitura: boolean;
  alterado: boolean;
  salvando: boolean;
  erro: string;
  aoMudar: (parcial: Partial<DadosDoPerfil>) => void;
  aoSalvar: () => void;
  aoDescartar: () => void;
}) {
  return (
    <form
      noValidate
      className="secao"
      style={{ gap: 16 }}
      onSubmit={(evento) => {
        evento.preventDefault();
        aoSalvar();
      }}
    >
      <Campo rotulo="Nome" icone={personOutline} autoComplete="name" maxLength={LIMITES_DO_PERFIL.name} value={rascunho.name} disabled={somenteLeitura} onMudar={(name) => aoMudar({ name })} />
      <Campo
        rotulo="Cargo ou ocupação"
        icone={briefcaseOutline}
        autoComplete="organization-title"
        maxLength={LIMITES_DO_PERFIL.headline}
        value={rascunho.headline}
        disabled={somenteLeitura}
        onMudar={(headline) => aoMudar({ headline })}
      />
      <Campo rotulo="Cidade" icone={locationOutline} autoComplete="address-level2" maxLength={LIMITES_DO_PERFIL.location} value={rascunho.location} disabled={somenteLeitura} onMudar={(location) => aoMudar({ location })} />
      <div className="secao" style={{ gap: 4 }}>
        <Campo rotulo="E-mail" icone={mailOutline} value={email} readOnly disabled onMudar={() => undefined} />
        <span className="fraco" style={{ fontSize: "0.75rem" }}>
          O e-mail é o seu acesso. Ele não muda por aqui.
        </span>
      </div>

      <label className="campo">
        <span className="etiqueta">Sobre você</span>
        <textarea
          className="area-de-texto"
          rows={4}
          maxLength={LIMITES_DO_PERFIL.bio}
          value={rascunho.bio}
          disabled={somenteLeitura}
          onChange={(evento) => aoMudar({ bio: evento.target.value })}
        />
        <span className="etiqueta" style={{ justifySelf: "end" }}>
          {rascunho.bio.length}/{LIMITES_DO_PERFIL.bio}
        </span>
      </label>

      <div className="secao" style={{ gap: 12 }}>
        <span className="etiqueta">Cor do avatar</span>
        <div className="cores" role="radiogroup" aria-label="Cor do avatar">
          {TONS_DO_AVATAR.map((tom) => {
            const ativo = tom === rascunho.avatarTone;
            return (
              <motion.button
                key={tom}
                type="button"
                role="radio"
                aria-checked={ativo}
                aria-label={ROTULO_DO_TOM[tom]}
                className="cor"
                disabled={somenteLeitura}
                whileTap={toqueDoDedo}
                onClick={() => {
                  toque();
                  aoMudar({ avatarTone: tom });
                }}
              >
                {/* A moldura azul desliza de uma cor para a outra. */}
                {ativo ? <motion.span layoutId="moldura-do-avatar" className="moldura" transition={mola} /> : null}
                <Avatar nome={rascunho.name} tom={tom} tamanho={44} />
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {erro ? (
          <motion.p key={erro} className="erro" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            {erro}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {/* A barra de salvar sobe quando há o que salvar e desce quando não há. */}
      <AnimatePresence>
        {alterado && !somenteLeitura ? (
          <motion.div
            className="barra-de-salvar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={curvaCheia}
          >
            <span className="etiqueta" style={{ color: "var(--brand)" }}>
              Não salvo
            </span>
            <span style={{ flex: 1 }} />
            <IonButton fill="clear" disabled={salvando} onClick={aoDescartar}>
              Descartar
            </IonButton>
            <IonButton type="submit" className="principal" disabled={salvando || rascunho.name.trim() === ""}>
              {salvando ? "Salvando" : "Salvar"}
            </IonButton>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
