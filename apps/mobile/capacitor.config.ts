import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.prumo.app",
  appName: "Prumo",
  webDir: "dist",
  // O app usa o fetch do webview, que entrega a resposta do assistente aos poucos. O BFF libera CORS só para as
  // origens do app (proxy.ts do frontend). O app fala só com o BFF, como o navegador.
  plugins: {
    SplashScreen: { launchAutoHide: true, backgroundColor: "#fafaf7" },
  },
};

export default config;
