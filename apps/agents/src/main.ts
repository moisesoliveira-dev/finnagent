import { createServer } from "node:http";
import * as Sentry from "@sentry/node";
import { criarGrafoDoAssistente } from "./assistente/adaptadores/grafo-do-assistente.js";
import { tratarPasso, tratarTeste } from "./assistente/adaptadores/http.js";
import { FabricaDeModelosLangChain } from "./assistente/adaptadores/modelos.js";
import { tratarExtrato } from "./extratos/adaptadores/http.js";
import { criarGrafo } from "./extratos/adaptadores/grafo.js";
import { OpenAiExtrato } from "./extratos/adaptadores/openai.js";
import { OrganizarExtrato } from "./extratos/aplicacao/organizar-extrato.js";
import { log } from "./log.js";

if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

const porta = process.env.PORT;
if (!porta) {
  log.error("Falta PORT.");
  process.exit(1);
}

const modelo = new OpenAiExtrato();
const servico = new OrganizarExtrato(criarGrafo(modelo, modelo));
const passo = tratarPasso(criarGrafoDoAssistente(new FabricaDeModelosLangChain()));
const extrato = tratarExtrato(servico);
const servidor = createServer((req, res) => {
  const caminho = (req.url ?? "").split("?")[0];
  if (req.method === "POST" && caminho === "/assistente/passo") return void passo(req, res);
  if (req.method === "POST" && caminho === "/provedores/testar") return void tratarTeste(req, res);
  void extrato(req, res);
});

servidor.on("error", (error) => {
  log.error({ err: error.message }, "agents não subiu");
  process.exit(1);
});

servidor.listen(Number(porta), "0.0.0.0", () => {
  log.info({ porta }, "agents no ar");
});
