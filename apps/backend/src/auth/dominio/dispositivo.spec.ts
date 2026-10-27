import { describe, expect, it } from "vitest";
import { dispositivoDe } from "./dispositivo.js";

describe("dispositivoDe", () => {
  it("reconhece os navegadores comuns", () => {
    expect(
      dispositivoDe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"),
    ).toBe("Chrome em Windows");
    expect(
      dispositivoDe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0"),
    ).toBe("Edge em Windows");
    expect(
      dispositivoDe("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"),
    ).toBe("Safari em iOS");
    expect(dispositivoDe("Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0")).toBe("Firefox em Linux");
  });

  it("não inventa quando não reconhece", () => {
    expect(dispositivoDe("")).toBe("Aparelho desconhecido");
    expect(dispositivoDe("coisa-estranha/1.0")).toBe("Aparelho desconhecido");
  });
});
