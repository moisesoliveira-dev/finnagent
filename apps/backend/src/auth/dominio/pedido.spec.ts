import { describe, expect, it } from "vitest";
import { interpretarCadastro, interpretarEntrada } from "./pedido.js";

describe("pedido de entrada", () => {
  it("normaliza o e-mail e não impõe regra de senha", () => {
    expect(interpretarEntrada({ email: "  Ana@Exemplo.COM ", password: "x" })).toEqual({
      email: "ana@exemplo.com",
      password: "x",
    });
  });

  it("recusa campo ausente, e-mail inválido e senha gigante", () => {
    const mensagem = "Informe o e-mail e a senha.";
    expect(interpretarEntrada({ email: "ana@exemplo.com" })).toBe(mensagem);
    expect(interpretarEntrada({ email: "sem-arroba", password: "x" })).toBe(mensagem);
    expect(interpretarEntrada({ email: "ana@exemplo.com", password: "a".repeat(129) })).toBe(mensagem);
    expect(interpretarEntrada(null)).toBe(mensagem);
  });
});

describe("pedido de cadastro", () => {
  const base = { name: "Ana", email: "ana@exemplo.com", password: "cavalo-bateria-2026" };

  it("aceita um cadastro válido", () => {
    expect(interpretarCadastro(base)).toEqual(base);
  });

  it("diz qual campo falhou", () => {
    expect(interpretarCadastro({ ...base, name: "  " })).toBe("Informe seu nome.");
    expect(interpretarCadastro({ ...base, email: "ana" })).toBe("Informe um e-mail válido.");
    expect(interpretarCadastro({ ...base, password: "curta" })).toBe(
      "A senha precisa ter de 10 a 128 caracteres.",
    );
  });

  it("recusa senha igual ao e-mail ou previsível", () => {
    expect(interpretarCadastro({ ...base, email: "senhasenha@exemplo.com", password: "senhasenha" })).toBe(
      "A senha não pode ser igual ao e-mail.",
    );
    expect(interpretarCadastro({ ...base, password: "1234567890" })).toBe("Escolha uma senha menos previsível.");
    expect(interpretarCadastro({ ...base, password: "aaaaaaaaaaaa" })).toBe("Escolha uma senha menos previsível.");
  });
});
