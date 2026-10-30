import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.prumo.app",
  appName: "Prumo",
  webDir: "dist",
  // O app usa o fetch do webview, que entrega a resposta do assistente aos poucos. O BFF libera CORS só para as
  // origens do app (proxy.ts do frontend). O app fala só com o BFF, como o navegador.
  plugins: {
    SplashScreen: { launchAutoHide: true, backgroundColor: "#fafaf7" },
    // Com o app aberto, o iOS também mostra o aviso; o sino atualiza pelo ouvinte do push.
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
