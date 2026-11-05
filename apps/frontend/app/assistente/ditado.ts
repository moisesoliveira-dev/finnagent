"use client";

import { useRef, useState, useSyncExternalStore } from "react";

/**
 * Ditado pelo reconhecimento de voz do navegador (Web Speech API). O áudio nunca sai daqui para a IA do Prumo:
 * o navegador transcreve, o texto cai na caixa, a pessoa revisa e envia como se tivesse digitado.
 */
type Resultado = { isFinal: boolean; 0: { transcript: string } };
type EventoDeResultado = { results: ArrayLike<Resultado> };
type EventoDeErro = { error: string };
type Reconhecimento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((evento: EventoDeResultado) => void) | null;
  onend: (() => void) | null;
  onerror: ((evento: EventoDeErro) => void) | null;
  start(): void;
  stop(): void;
};
type JanelaComVoz = Window & {
  SpeechRecognition?: new () => Reconhecimento;
  webkitSpeechRecognition?: new () => Reconhecimento;
};

function construtor() {
  if (typeof window === "undefined") return null;
  const janela = window as JanelaComVoz;
  return janela.SpeechRecognition ?? janela.webkitSpeechRecognition ?? null;
}

const semAssinatura = () => () => undefined;

export const MENSAGENS_DO_DITADO: Record<string, string> = {
  "not-allowed": "O navegador não deu acesso ao microfone. Permita o microfone para ditar.",
  "service-not-allowed": "O navegador não deu acesso ao microfone. Permita o microfone para ditar.",
  "audio-capture": "Nenhum microfone foi encontrado.",
  network: "O reconhecimento de voz precisa de conexão com a internet.",
  "no-speech": "Não ouvi nada. Tente de novo, mais perto do microfone.",
};

export function useDitado(aoTexto: (texto: string) => void) {
  // No servidor e durante a hidratação, "sem suporte": o botão só aparece depois, sem divergência de HTML.
  const suportado = useSyncExternalStore(semAssinatura, () => construtor() !== null, () => false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState("");
  const atual = useRef<Reconhecimento | null>(null);

  /**
   * Pede o microfone antes de ouvir. O `SpeechRecognition.start()` até pergunta sozinho em alguns navegadores,
   * mas de forma discreta; o `getUserMedia` abre o pedido do navegador na hora e diz na cara quando é recusado.
   */
  async function pedirMicrofone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("O microfone só funciona em página segura (https) ou no localhost.");
      return false;
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Só a permissão interessa: quem grava é o reconhecimento de voz.
      for (const faixa of fluxo.getTracks()) faixa.stop();
      return true;
    } catch (error) {
      const nome = error instanceof Error ? error.name : "";
      setErro(
        nome === "NotAllowedError" || nome === "SecurityError"
          ? MENSAGENS_DO_DITADO["not-allowed"]
          : nome === "NotFoundError"
            ? MENSAGENS_DO_DITADO["audio-capture"]
            : "Não consegui usar o microfone. Confira as permissões do navegador.",
      );
      return false;
    }
  }

  async function iniciar() {
    const Voz = construtor();
    if (!Voz || atual.current) return;
    setErro("");
    if (!(await pedirMicrofone())) return;
    // A pessoa pode ter parado enquanto o navegador perguntava.
    if (atual.current) return;
    const reconhecimento = new Voz();
    reconhecimento.lang = "pt-BR";
    reconhecimento.continuous = true;
    reconhecimento.interimResults = true;
    reconhecimento.onresult = (evento) => {
      // O navegador manda a lista inteira desde o início: o que já fechou e o trecho que ainda está ouvindo.
      let texto = "";
      for (let i = 0; i < evento.results.length; i += 1) texto += evento.results[i][0].transcript;
      aoTexto(texto.replace(/\s+/g, " ").trim());
    };
    reconhecimento.onerror = (evento) => {
      if (evento.error === "aborted") return;
      setErro(MENSAGENS_DO_DITADO[evento.error] ?? "O reconhecimento de voz falhou. Tente de novo.");
    };
    reconhecimento.onend = () => {
      atual.current = null;
      setOuvindo(false);
    };
    setErro("");
    reconhecimento.start();
    atual.current = reconhecimento;
    setOuvindo(true);
  }

  function parar() {
    atual.current?.stop();
  }

  return { suportado, ouvindo, erro, iniciar, parar };
}
