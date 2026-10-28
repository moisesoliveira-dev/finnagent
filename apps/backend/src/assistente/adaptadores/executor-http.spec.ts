import { createServer, type Server } from "node:http";
import { FERRAMENTAS_DO_ASSISTENTE } from "@finnagent/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ExecutorHttp } from "./executor-http.js";
import { ROTAS_DAS_FERRAMENTAS, montarUrl } from "./rotas-das-ferramentas.js";

type Recebido = { metodo: string; url: string; autorizacao: string; corpo: unknown };

const sessao = "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a01";
const credencial = { token: "token-da-ana", fuso: "America/Manaus" };

describe("executor das ferramentas", () => {
  let servidor: Server;
  let recebidos: Recebido[] = [];
  let responder: (url: string) => { status: number; corpo?: unknown } = () => ({ status: 200, corpo: { ok: true } });

  beforeAll(async () => {
    servidor = createServer((req, res) => {
      let texto = "";
      req.on("data", (parte) => (texto += parte));
      req.on("end", () => {
        recebidos.push({
          metodo: req.method ?? "",
          url: req.url ?? "",
          autorizacao: String(req.headers.authorization ?? ""),
          corpo: texto ? JSON.parse(texto) : undefined,
        });
        const { status, corpo } = responder(req.url ?? "");
        res.writeHead(status, { "content-type": "application/json" });
        res.end(corpo === undefined ? undefined : JSON.stringify(corpo));
      });
    });
    await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
    const endereco = servidor.address();
    process.env.PORT = String(typeof endereco === "object" && endereco ? endereco.port : 0);
  });

  afterAll(() => {
    servidor.close();
  });

  beforeEach(() => {
    recebidos = [];
    responder = () => ({ status: 200, corpo: { ok: true } });
  });

  it("chama a API com o token da pessoa e o formulário completo, como a tela", async () => {
    const executor = new ExecutorHttp();
    const resultado = await executor.executar(
      {
        id: "c1",
        nome: "criar_lancamento",
        args: { sessionId: sessao, name: "Mercado", date: "2026-10-28", mode: "outflows", category: "unique", cents: 5000 },
      },
      credencial,
    );
    expect(resultado).toEqual({ ok: true, conteudo: '{"ok":true}', detalhe: "" });
    expect(recebidos).toHaveLength(1);
    const [pedido] = recebidos;
    expect(pedido).toMatchObject({ metodo: "POST", url: "/lancamentos", autorizacao: "Bearer token-da-ana" });
    expect(pedido.corpo).toMatchObject({
      sessionId: sessao,
      name: "Mercado",
      description: "",
      justification: "Registrado pelo assistente.",
      status: "pending",
      transactionType: "unusual",
      priority: "nopriority",
      cents: 5000,
      installments: null,
      recurrence: null,
    });
    expect((pedido.corpo as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("não chama a API com argumentos inválidos: devolve o erro para o modelo corrigir", async () => {
    const resultado = await new ExecutorHttp().executar({ id: "c1", nome: "criar_meta", args: { name: "", targetCents: -5 } }, credencial);
    expect(resultado.ok).toBe(false);
    expect(resultado.conteudo).toContain("Argumentos inválidos");
    expect(recebidos).toHaveLength(0);
  });

  it("recusa ferramenta fora do catálogo sem tocar na API", async () => {
    for (const nome of ["salvar_configuracoes", "alterar_senha", "remover_usuario", "exportar_dados", "perguntar"]) {
      const resultado = await new ExecutorHttp().executar({ id: "x", nome, args: {} }, credencial);
      expect(resultado.ok).toBe(false);
    }
    expect(recebidos).toHaveLength(0);
  });

  it("repassa o erro da API e trata o 204", async () => {
    responder = (url) => (url.startsWith("/metas/") ? { status: 204 } : { status: 400, corpo: { message: "Informe o mês e o ano do prazo." } });
    const apagar = await new ExecutorHttp().executar({ id: "c1", nome: "excluir_meta", args: { id: sessao, resumo: "a meta Viagem" } }, credencial);
    expect(apagar).toEqual({ ok: true, conteudo: "Feito.", detalhe: "" });
    expect(recebidos[0]).toMatchObject({ metodo: "DELETE", url: `/metas/${sessao}` });
    const criar = await new ExecutorHttp().executar({ id: "c2", nome: "criar_meta", args: { name: "X", targetCents: 10, dueYear: 2027 } }, credencial);
    expect(criar).toEqual({ ok: false, conteudo: "Erro 400: Informe o mês e o ano do prazo.", detalhe: "Informe o mês e o ano do prazo." });
  });

  it("monta o compromisso com o fuso da conta e dia inteiro quando não há hora", async () => {
    await new ExecutorHttp().executar(
      { id: "c1", nome: "criar_compromisso", args: { title: "Dentista", year: 2026, month: 10, day: 30, calendar: "Pessoal", category: "time" } },
      credencial,
    );
    expect(recebidos[0].corpo).toMatchObject({ title: "Dentista", allDay: true, time: null, endTime: null, timezone: "America/Manaus" });
  });

  it("corta resultado grande para não estourar o contexto do modelo", async () => {
    responder = () => ({ status: 200, corpo: { texto: "x".repeat(20_000) } });
    const resultado = await new ExecutorHttp().executar({ id: "c1", nome: "consultar_metas", args: {} }, credencial);
    expect(resultado.conteudo.length).toBeLessThan(12_200);
    expect(resultado.conteudo).toContain("resultado cortado");
  });
});

describe("rotas das ferramentas", () => {
  it("toda ferramenta do catálogo tem rota, e toda rota tem ferramenta", () => {
    const catalogo = FERRAMENTAS_DO_ASSISTENTE.map((item) => item.nome).sort();
    expect(Object.keys(ROTAS_DAS_FERRAMENTAS).sort()).toEqual(catalogo);
  });

  it("nenhuma rota alcança perfil, configurações, usuários, dados, autenticação ou a própria IA", () => {
    const exemplo = { id: sessao, number: 1, year: 2026, month: 10, day: 1, scope: "mes" };
    for (const rota of Object.values(ROTAS_DAS_FERRAMENTAS)) {
      const caminho = rota.caminho(exemplo);
      expect(caminho).not.toMatch(/^(perfil|configuracoes|usuarios|dados|auth|ia|assistente|calendarios)(\/|$)/);
    }
  });

  it("toda ferramenta que apaga ou cancela pede o resumo para a confirmação", () => {
    for (const ferramenta of FERRAMENTAS_DO_ASSISTENTE.filter((item) => item.destrutiva)) {
      expect(Object.keys(ferramenta.esquema.shape)).toContain("resumo");
    }
    const apagam = Object.entries(ROTAS_DAS_FERRAMENTAS).filter(([, rota]) => rota.metodo === "DELETE").map(([nome]) => nome);
    for (const nome of apagam) expect(FERRAMENTAS_DO_ASSISTENTE.find((item) => item.nome === nome)?.destrutiva).toBe(true);
  });

  it("monta a consulta sem campos vazios", () => {
    const url = montarUrl("http://x:1", ROTAS_DAS_FERRAMENTAS.consultar_lancamentos, { year: 2026, q: "", month: undefined });
    expect(url.toString()).toBe("http://x:1/financas/base?year=2026");
  });
});
