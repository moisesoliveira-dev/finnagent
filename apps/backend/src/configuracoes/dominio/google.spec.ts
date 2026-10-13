import { redirectPermitido, urlDeAutorizacao } from "./google.js";

describe("autorização do Google", () => {
  it("monta a autorização com o redirect e o estado", () => {
    const url = new URL(
      urlDeAutorizacao("cliente", "http://localhost:3000/api/configuracoes/google/retorno", "estado"),
    );
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("cliente");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/configuracoes/google/retorno");
    expect(url.searchParams.get("state")).toBe("estado");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("aceita só o retorno desta aplicação", () => {
    expect(redirectPermitido("http://localhost:3000/api/configuracoes/google/retorno")).toBe(true);
    expect(redirectPermitido("https://prumo.example/api/configuracoes/google/retorno")).toBe(true);
    expect(redirectPermitido("https://prumo.example/outra")).toBe(false);
    expect(redirectPermitido("javascript:alert(1)")).toBe(false);
  });
});
