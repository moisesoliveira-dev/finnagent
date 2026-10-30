from PIL import Image
import colorsys, pathlib

RAIZ = pathlib.Path("D:/finnagent")
MOBILE = RAIZ / "apps/mobile"
WEB = RAIZ / "apps/frontend"
SIMBOLO = RAIZ / "docs/marca/simbolo-original.png"
HORIZONTAL = RAIZ / "docs/marca/horizontal-original.png"
FUNDO = (250, 250, 247, 255)  # --bg do tema claro


def limpar(img: Image.Image, corte=56):
    """Tira o véu de pixels quase transparentes das bordas e recorta o que sobra."""
    img = img.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < corte:
                px[x, y] = (0, 0, 0, 0)
    return img.crop(img.getbbox())


def claro(img: Image.Image):
    """Variante para fundo escuro: o azul-marinho vira quase branco, o brilho branco some e o verde fica mais vivo."""
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if s <= 0.2 and l > 0.35:
                px[x, y] = (0, 0, 0, 0)  # o brilho do miolo do P e o cinza de suas bordas: no escuro, o miolo é o próprio fundo
                continue
            if 0.28 < h < 0.52 and s > 0.2:
                # O verde: um esmeralda mais claro e menos saturado, que não vibra sobre o fundo escuro.
                nl = 0.46 + 0.16 * l
                nr, ng, nb = colorsys.hls_to_rgb(0.41, nl, 0.58)
                px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
                continue
            if (0.52 < h < 0.75 and s > 0.15 and l < 0.45) or (s <= 0.2 and l < 0.35):
                t_ = min(1, l / 0.45)
                nl = 0.97 - 0.14 * t_
                nr, ng, nb = colorsys.hls_to_rgb(0.60, nl, 0.25)
                px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return out


def caber(img: Image.Image, lado: int, proporcao: float):
    alvo = int(lado * proporcao)
    esc = alvo / max(img.size)
    return img.resize((max(1, round(img.width * esc)), max(1, round(img.height * esc))), Image.LANCZOS)


def tela(lado: int, fundo, marca: Image.Image, proporcao: float):
    base = Image.new("RGBA", (lado, lado), fundo)
    m = caber(marca, lado, proporcao)
    base.alpha_composite(m, ((lado - m.width) // 2, (lado - m.height) // 2))
    return base


simbolo = limpar(Image.open(SIMBOLO))
horizontal = limpar(Image.open(HORIZONTAL))

# Dentro do app mobile (tela de entrada), nas duas versões de tema.
dest = MOBILE / "src/assets"
dest.mkdir(parents=True, exist_ok=True)
caber(simbolo, 720, 1).save(dest / "marca-simbolo.png", optimize=True)
caber(claro(simbolo), 720, 1).save(dest / "marca-simbolo-escuro.png", optimize=True)

# Fontes de ícone e splash para o @capacitor/assets.
assets = MOBILE / "assets"
tela(1024, FUNDO, simbolo, 0.62).save(assets / "icon-only.png")
tela(1024, (0, 0, 0, 0), simbolo, 0.46).save(assets / "icon-foreground.png")  # dentro da zona segura do ícone adaptável
Image.new("RGBA", (1024, 1024), FUNDO).save(assets / "icon-background.png")
tela(2732, FUNDO, simbolo, 0.22).save(assets / "splash.png")
tela(2732, (13, 17, 17, 255), claro(simbolo), 0.22).save(assets / "splash-dark.png")

# Favicon e ícones do navegador, no mobile (dev) e no web.
icone = tela(512, FUNDO, simbolo, 0.74)
icone.resize((64, 64), Image.LANCZOS).save(MOBILE / "public/favicon.png")
icone.save(WEB / "app/icon.png", optimize=True)
icone.resize((180, 180), Image.LANCZOS).save(WEB / "app/apple-icon.png", optimize=True)
icone.save(WEB / "app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

# Pré-visualização para conferir.
prev = Image.new("RGBA", (1400, 720), FUNDO)
prev.alpha_composite(caber(simbolo, 300, 1), (30, 30))
prev.alpha_composite(caber(horizontal, 640, 1), (350, 380))
esc = Image.new("RGBA", (700, 720), (13, 17, 17, 255))
esc.alpha_composite(caber(claro(simbolo), 600, 1), (50, 40))
prev.alpha_composite(esc, (700, 0))
prev.save("D:/finnagent/apps/mobile/_previa.png")
print("ok", simbolo.size, horizontal.size)
