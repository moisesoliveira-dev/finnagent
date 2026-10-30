import { IonButton, IonContent, IonIcon, IonPage } from "@ionic/react";
import { SENHA_MINIMA, type SessaoAberta } from "@finnagent/contracts";
import { eyeOffOutline, eyeOutline, lockClosedOutline, mailOutline, personOutline, shieldCheckmarkOutline } from "ionicons/icons";
import { AnimatePresence, animate, motion, type Variants } from "motion/react";
import { useRef, useState, type FormEvent } from "react";
import { ErroDaApi, enviar } from "../api/cliente";
import { guardarSessao } from "../api/sessao";
import { MedidorDeForca } from "../componentes/MedidorDeForca";
import { Simbolo } from "../componentes/Simbolo";
import { toque } from "../haptico";
import { curvaCheia, toqueDoDedo } from "../movimento";

type Modo = "entrar" | "cadastro";

const FRASE = ["Seu", "dinheiro,", "no", "caminho", "certo."];
// As barras do fundo: um gráfico que sobe, como o do próprio P da marca.
const BARRAS = [28, 44, 36, 62, 54, 86, 100];

const TEXTOS: Record<Modo, { titulo: string; subtitulo: string; botao: string; troca: string; trocaBotao: string }> = {
  entrar: {
    titulo: "Entrar",
    subtitulo: "Use o e-mail e a senha da sua conta.",
    botao: "Entrar",
    troca: "Ainda não tem conta?",
    trocaBotao: "Criar conta",
  },
  cadastro: {
    titulo: "Criar conta",
    subtitulo: "Leva um minuto. Depois o consultor te ajuda a organizar o resto.",
    botao: "Criar conta",
    troca: "Já tem conta?",
    trocaBotao: "Entrar",
  },
};

const palavras: Variants = { oculto: {}, visivel: { transition: { staggerChildren: 0.09, delayChildren: 1.1 } } };
const palavra: Variants = { oculto: { opacity: 0, y: 22 }, visivel: { opacity: 1, y: 0, transition: curvaCheia } };
const campos: Variants = { oculto: {}, visivel: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } };
const campo: Variants = { oculto: { opacity: 0, y: 16 }, visivel: { opacity: 1, y: 0, transition: curvaCheia } };

/** Três pontos que pulam em sequência, no lugar do texto do botão enquanto o servidor responde. */
function Pontos() {
  return (
    <span style={{ display: "inline-flex", gap: 4 }} role="status" aria-label="Enviando">
      {[0, 1, 2].map((indice) => (
        <motion.span
          key={indice}
          style={{ width: 6, height: 6, background: "currentColor" }}
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 0.7, delay: indice * 0.12, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

export function Login() {
  const [modo, setModo] = useState<Modo>("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [vendo, setVendo] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const cadastro = modo === "cadastro";
  const texto = TEXTOS[modo];

  /** O erro sacode os campos, como um "não" com a cabeça. */
  function recusar(mensagem: string) {
    setErro(mensagem);
    toque(true);
    if (formulario.current) void animate(formulario.current, { x: [0, -10, 10, -7, 7, -3, 0] }, { duration: 0.45 });
  }

  function alternar() {
    toque();
    setErro("");
    setSenha("");
    setVendo(false);
    setModo(cadastro ? "entrar" : "cadastro");
  }

  async function enviarDados(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    if (cadastro && !nome.trim()) return recusar("Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return recusar("Informe um e-mail válido.");
    if (!senha) return recusar("Informe a senha.");
    if (cadastro && senha.length < SENHA_MINIMA) return recusar(`A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`);
    setErro("");
    setEnviando(true);
    try {
      const corpo = cadastro ? { name: nome.trim(), email: email.trim(), password: senha } : { email: email.trim(), password: senha };
      const sessao = await enviar<SessaoAberta>(cadastro ? "/api/auth/cadastro" : "/api/auth/entrar", corpo);
      toque();
      await guardarSessao(sessao);
    } catch (error) {
      setEnviando(false);
      setSenha("");
      if (error instanceof ErroDaApi && error.status === 409) return recusar(error.message || "Já existe uma conta com este e-mail.");
      recusar(error instanceof Error ? error.message : cadastro ? "Não foi possível criar a conta." : "Não foi possível entrar.");
    }
  }

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="tela-login pontos">
          {/* O gráfico ao fundo: cada barra sobe uma depois da outra, bem de leve. */}
          <div className="barras-do-fundo" aria-hidden>
            {BARRAS.map((altura, indice) => (
              <motion.span
                key={indice}
                initial={{ height: 0 }}
                animate={{ height: `${altura}%` }}
                transition={{ duration: 1.1, delay: 0.5 + indice * 0.1, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </div>

          <section className="topo-login">
            {/* O P pende de um fio de prumo: o fio desce, a marca cai com mola, balança e assenta. */}
            <motion.div
              className="pendulo"
              style={{ transformOrigin: "50% 0%" }}
              animate={{ rotate: [0, 7, -5, 3, -1.5, 0] }}
              transition={{ duration: 2.4, delay: 0.7, ease: "easeInOut" }}
            >
              <motion.span
                className="fio"
                aria-hidden
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                style={{ transformOrigin: "50% 0%" }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
              <motion.h1
                className="marca-completa"
                aria-label="Prumo"
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 140, damping: 11, delay: 0.45 }}
              >
                <Simbolo altura={104} />
              </motion.h1>
            </motion.div>

            <motion.p className="frase-login" variants={palavras} initial="oculto" animate="visivel" aria-label={FRASE.join(" ")}>
              {FRASE.map((palavraDaFrase, indice) => (
                <motion.span key={palavraDaFrase} variants={palavra} className={indice === FRASE.length - 1 ? "destaque-verde" : undefined} aria-hidden>
                  {palavraDaFrase}
                </motion.span>
              ))}
            </motion.p>
          </section>

          {/* A folha com o formulário sobe da base da tela. */}
          <motion.form
            className="folha"
            onSubmit={(evento) => void enviarDados(evento)}
            noValidate
            layout="position"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 20, delay: 1.5 }}
          >
            <motion.div variants={campos} initial="oculto" animate="visivel" className="secao" style={{ gap: 16 }}>
              <motion.div variants={campo} className="secao" style={{ gap: 4 }}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={modo}
                    className="secao"
                    style={{ gap: 4 }}
                    initial={{ opacity: 0, x: cadastro ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: cadastro ? -20 : 20 }}
                    transition={{ duration: 0.18 }}
                  >
                    <h2 className="titulo-da-folha">{texto.titulo}</h2>
                    <span className="fraco">{texto.subtitulo}</span>
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              <div ref={formulario} className="secao" style={{ gap: 16 }}>
                {/* O nome só existe no cadastro: o campo abre e fecha em altura. */}
                <AnimatePresence initial={false}>
                  {cadastro ? (
                    <motion.label
                      key="nome"
                      className="campo"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: "hidden" }}
                    >
                      <span className="etiqueta">Nome</span>
                      <span className="entrada-com-icone">
                        <IonIcon icon={personOutline} aria-hidden />
                        <input
                          type="text"
                          autoComplete="name"
                          autoCapitalize="words"
                          enterKeyHint="next"
                          maxLength={80}
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              emailRef.current?.focus();
                            }
                          }}
                        />
                      </span>
                    </motion.label>
                  ) : null}
                </AnimatePresence>

                <motion.label className="campo" variants={campo}>
                  <span className="etiqueta">E-mail</span>
                  <span className="entrada-com-icone">
                    <IonIcon icon={mailOutline} aria-hidden />
                    <input
                      ref={emailRef}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      enterKeyHint="next"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          senhaRef.current?.focus();
                        }
                      }}
                    />
                  </span>
                </motion.label>

                <motion.label className="campo" variants={campo}>
                  <span className="etiqueta">Senha</span>
                  <span className="entrada-com-icone">
                    <IonIcon icon={lockClosedOutline} aria-hidden />
                    <input
                      ref={senhaRef}
                      type={vendo ? "text" : "password"}
                      autoComplete={cadastro ? "new-password" : "current-password"}
                      enterKeyHint="go"
                      maxLength={128}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                    />
                    <motion.button
                      type="button"
                      className="olho"
                      aria-label={vendo ? "Esconder a senha" : "Mostrar a senha"}
                      whileTap={toqueDoDedo}
                      onClick={() => {
                        toque();
                        setVendo((atual) => !atual);
                      }}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={vendo ? "esconder" : "mostrar"}
                          style={{ display: "inline-flex" }}
                          initial={{ opacity: 0, rotate: -40, scale: 0.6 }}
                          animate={{ opacity: 1, rotate: 0, scale: 1 }}
                          exit={{ opacity: 0, rotate: 40, scale: 0.6 }}
                          transition={{ duration: 0.14 }}
                        >
                          <IonIcon icon={vendo ? eyeOffOutline : eyeOutline} />
                        </motion.span>
                      </AnimatePresence>
                    </motion.button>
                  </span>
                </motion.label>

                {/* O medidor da senha: quatro partes que enchem e mudam de cor conforme a senha melhora. */}
                <AnimatePresence initial={false}>
                  {cadastro ? (
                    <motion.div
                      key="forca"
                      className="secao"
                      style={{ gap: 8, overflow: "hidden" }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <MedidorDeForca senha={senha} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <AnimatePresence initial={false}>
                {erro ? (
                  <motion.p
                    key={erro}
                    className="erro"
                    role="alert"
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    {erro}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <motion.div variants={campo} whileTap={toqueDoDedo}>
                <IonButton type="submit" expand="block" className="principal" disabled={enviando}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={enviando ? "pontos" : modo}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {enviando ? <Pontos /> : texto.botao}
                    </motion.span>
                  </AnimatePresence>
                </IonButton>
              </motion.div>

              <motion.p className="troca-de-modo" variants={campo}>
                <span className="fraco">{texto.troca}</span>
                <motion.button type="button" className="link" whileTap={toqueDoDedo} onClick={alternar} disabled={enviando}>
                  {texto.trocaBotao}
                </motion.button>
              </motion.p>

              <motion.p className="seguro" variants={campo}>
                <IonIcon icon={shieldCheckmarkOutline} aria-hidden />
                Sua sessão fica guardada, protegida, só neste aparelho.
              </motion.p>
            </motion.div>
          </motion.form>
        </div>
      </IonContent>
    </IonPage>
  );
}
