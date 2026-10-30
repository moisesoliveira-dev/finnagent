import { setupIonicReact } from "@ionic/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/display.css";
import "@fontsource/tasa-orbiter/latin-400.css";
import "@fontsource/tasa-orbiter/latin-500.css";
import "@fontsource/tasa-orbiter/latin-700.css";
import "@fontsource/geist-mono/latin-400.css";
import "@fontsource/geist-mono/latin-500.css";
import "./tema/tema.css";

// O mesmo visual nos dois sistemas: o tema do Prumo vale mais que o padrão de cada plataforma.
setupIonicReact({ mode: "md", rippleEffect: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
