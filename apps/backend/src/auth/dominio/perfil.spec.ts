import { describe, expect, it } from "vitest";
import { interpretarPerfil, interpretarTroca } from "./perfil.js";

const valido = { name: "  Ana Souza ", headline: "Analista", location: "Recife", bio: "Gosto de planilhas.", avatarTone: "event" };

describe("interpretarPerfil", () => {
  it("aceita o perfil e apara os espaços", () => {
    expect(interpretarPerfil(valido)).toEqual({ ...valido, name: "Ana Souza" });
  });

  it("deixa cargo, cidade e texto vazios quando não vêm", () => {
    expect(interpretarPerfil({ name: "Ana", avatarTone: "brand" })).toEqual({
      name: "Ana",
      headline: "",
      location: "",
      bio: "",
      avatarTone: "brand",
    });
  });

  it("recusa nome vazio, texto longo e cor que não existe", () => {
    expect(interpretarPerfil({ ...valido, name: "   " })).toBe("Informe seu nome.");
    expect(interpretarPerfil({ ...valido, bio: "x".repeat(241) })).toMatch(/até 240/);
    expect(interpretarPerfil({ ...valido, headline: "x".repeat(81) })).toMatch(/cargo/);
    expect(interpretarPerfil({ ...valido, avatarTone: "rosa" })).toBe("Escolha uma das cores do avatar.");
  });
});

describe("interpretarTroca", () => {
  const email = "ana@exemplo.com";

  it("aceita uma senha nova boa", () => {
    expect(interpretarTroca({ currentPassword: "antiga-123", newPassword: "uma-senha-boa-9" }, email)).toEqual({
      currentPassword: "antiga-123",
      newPassword: "uma-senha-boa-9",
    });
  });

  it("recusa senha nova igual à atual, curta ou previsível", () => {
    expect(interpretarTroca({ currentPassword: "uma-senha-boa-9", newPassword: "uma-senha-boa-9" }, email)).toMatch(
      /diferente/,
    );
    expect(interpretarTroca({ currentPassword: "antiga-123", newPassword: "curta" }, email)).toMatch(/precisa ter de/);
    expect(interpretarTroca({ currentPassword: "antiga-123", newPassword: "senha12345" }, email)).toBe(
      "Escolha uma senha menos previsível.",
    );
    expect(interpretarTroca({ currentPassword: "antiga-123", newPassword: "ana@exemplo.com" }, email)).toBe(
      "A senha não pode ser igual ao e-mail.",
    );
  });

  it("pede a senha atual", () => {
    expect(interpretarTroca({ currentPassword: "", newPassword: "uma-senha-boa-9" }, email)).toBe("Informe a senha atual.");
  });
});
