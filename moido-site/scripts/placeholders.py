"""Gera imagens e sequências PROVISÓRIAS no mesmo formato das reais (Gemini/Flow).

Saída (em public/):
  seq/f1/0001.webp…  hambúrguer se abrindo (G1 -> G2)
  seq/f2/0001.webp…  prensa na chapa (G3 -> G4)
  seq/f3/0001.webp…  cheddar escorrendo (G5)
  img/g1.webp, img/g1-cutout.webp (com transparência), img/g2.webp, img/g4.webp, img/g5.webp,
  img/g6.webp, img/g7.webp, img/g8.webp (cardápio)

Quando os arquivos reais chegarem, scripts/prepare_real.py substitui tudo isso.
"""
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
W, H, SS = 1600, 900, 2  # tamanho final e supersampling
BG = (14, 11, 9)
N1, N2, N3 = 96, 72, 60


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def canvas(alpha=False):
    if alpha:
        return Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    return Image.new("RGBA", (W * SS, H * SS), BG + (255,))


def finish(im, alpha=False):
    im = im.resize((W, H), Image.LANCZOS)
    return im if alpha else im.convert("RGB")


def S(v):
    return v * SS


def ellipse_pts(cx, cy, rx, ry, a0=0, a1=2 * math.pi, n=120, jitter=None, seed=0):
    rnd = random.Random(seed)
    pts = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        r = 1.0
        if jitter:
            r += jitter * (math.sin(a * 7 + seed) * 0.5 + math.sin(a * 13 + seed * 2) * 0.3 + rnd.uniform(-0.3, 0.3))
        pts.append((S(cx + math.cos(a) * rx * r), S(cy + math.sin(a) * ry * r)))
    return pts


def grad_layer(size, top, bottom, box):
    """Imagem com degradê vertical entre duas cores, limitada à caixa (x0,y0,x1,y1) em px SS."""
    x0, y0, x1, y1 = [int(v) for v in box]
    h = max(1, y1 - y0)
    g = np.zeros((size[1], size[0], 4), dtype=np.uint8)
    t = np.clip((np.arange(size[1]) - y0) / h, 0, 1)[:, None]
    for c in range(3):
        g[:, :, c] = (top[c] * (1 - t) + bottom[c] * t).astype(np.uint8)
    g[:, :, 3] = 255
    return Image.fromarray(g, "RGBA")


def fill_poly(im, pts, top, bottom=None):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    ys = [p[1] for p in pts]
    src = grad_layer(im.size, top, bottom or top, (0, min(ys), 0, max(ys)))
    im.paste(src, (0, 0), mask)
    return mask


def cylinder(im, cx, cy, rx, ry, th, top, side, side2=None, jitter=None, seed=0):
    """Disco em perspectiva: lateral + face superior."""
    lower = ellipse_pts(cx, cy + th / 2, rx, ry, 0, math.pi, jitter=jitter, seed=seed)
    upper = ellipse_pts(cx, cy - th / 2, rx, ry, math.pi, 0, jitter=jitter, seed=seed)
    fill_poly(im, lower + upper[::-1][::-1], side, side2 or side)
    fill_poly(im, ellipse_pts(cx, cy - th / 2, rx, ry, jitter=jitter, seed=seed), top[0], top[1])


def speckle(im, cx, cy, rx, ry, color, n, seed, size=(2, 5)):
    rnd = random.Random(seed)
    d = ImageDraw.Draw(im)
    for _ in range(n):
        a = rnd.uniform(0, 2 * math.pi)
        r = math.sqrt(rnd.uniform(0, 1))
        x, y = cx + math.cos(a) * rx * r, cy + math.sin(a) * ry * r
        s = rnd.uniform(*size)
        d.ellipse([S(x - s), S(y - s * 0.6), S(x + s), S(y + s * 0.6)], fill=color)


# ---------- camadas do hambúrguer ----------
RX, RY = 255, 52


def bun_top(im, cx, cy, dark=False):
    base = (190, 98, 34) if not dark else (70, 38, 22)
    hi = (236, 158, 66) if not dark else (110, 62, 36)
    dome = ellipse_pts(cx, cy + 40, RX + 8, 170, math.pi, 2 * math.pi, n=160)
    rim = ellipse_pts(cx, cy + 40, RX + 8, RY + 6, 0, math.pi, n=100)
    fill_poly(im, dome + rim, hi, base)
    # brilho
    glow = Image.new("L", im.size, 0)
    ImageDraw.Draw(glow).ellipse([S(cx - 150), S(cy - 110), S(cx + 40), S(cy - 30)], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(S(28)))
    im.paste(Image.new("RGBA", im.size, (255, 236, 200, 255)), (0, 0), glow)
    rnd = random.Random(7)
    d = ImageDraw.Draw(im)
    for _ in range(26):
        a = rnd.uniform(math.pi * 1.08, math.pi * 1.92)
        r = rnd.uniform(0.25, 0.9)
        x = cx + math.cos(a) * (RX - 20) * r
        y = cy + 40 + math.sin(a) * 150 * r
        d.ellipse([S(x - 6), S(y - 3), S(x + 6), S(y + 3)], fill=(246, 228, 188))


def bun_bottom(im, cx, cy, dark=False):
    top = ((233, 176, 104), (214, 150, 80)) if not dark else ((96, 58, 34), (80, 46, 28))
    cylinder(im, cx, cy, RX, RY, 44, top, (188, 104, 42) if not dark else (60, 34, 20), (150, 78, 30) if not dark else (44, 24, 14))


def patty(im, cx, cy, seed=1):
    cylinder(im, cx, cy, RX + 10, RY + 4, 32, ((86, 50, 30), (64, 36, 22)), (52, 28, 16), (34, 18, 10), jitter=0.035, seed=seed)
    speckle(im, cx, cy - 16, RX - 10, RY - 8, (40, 22, 12), 160, seed)
    speckle(im, cx, cy - 16, RX - 30, RY - 14, (120, 72, 40), 60, seed + 9, (1.5, 3))


def cheddar(im, cx, cy, drips=True, color=(242, 168, 29)):
    hi = tuple(min(255, c + 20) for c in color)
    pts = [(S(cx - RX - 26), S(cy)), (S(cx), S(cy - RY - 16)), (S(cx + RX + 26), S(cy)), (S(cx), S(cy + RY + 16))]
    fill_poly(im, pts, hi, color)
    if drips:
        d = ImageDraw.Draw(im)
        for dx, ln in ((-RX - 20, 46), (RX + 18, 38), (-60, 30), (90, 52)):
            x, y = cx + dx, cy + (RY + 10 if abs(dx) < 120 else 4)
            d.rounded_rectangle([S(x - 9), S(y - 6), S(x + 9), S(y + ln)], radius=S(9), fill=color)


def sauce(im, cx, cy):
    fill_poly(im, ellipse_pts(cx, cy, RX - 8, RY - 6, jitter=0.06, seed=3), (232, 120, 46), (214, 98, 34))


def pickles(im, cx, cy, color=((124, 154, 58), (169, 192, 96))):
    d = ImageDraw.Draw(im)
    for dx, dy in ((-150, -6), (-40, 10), (70, -10), (170, 6), (10, -26)):
        x, y = cx + dx, cy + dy
        d.ellipse([S(x - 48), S(y - 14), S(x + 48), S(y + 14)], fill=color[1])
        d.ellipse([S(x - 40), S(y - 10), S(x + 40), S(y + 10)], fill=color[0])


def onions(im, cx, cy):
    d = ImageDraw.Draw(im)
    rnd = random.Random(5)
    for _ in range(18):
        x = cx + rnd.uniform(-RX + 30, RX - 30)
        y = cy + rnd.uniform(-RY + 18, RY - 18)
        w = rnd.uniform(30, 60)
        d.arc([S(x - w), S(y - 10), S(x + w), S(y + 10)], rnd.uniform(0, 90), rnd.uniform(180, 300), fill=(205, 128, 50), width=S(6))


def bacon(im, cx, cy):
    d = ImageDraw.Draw(im)
    for k, dy in enumerate((-14, 6)):
        pts = []
        for i in range(41):
            x = cx - RX + 10 + i * (2 * RX - 20) / 40
            pts.append((S(x), S(cy + dy + math.sin(i * 0.7 + k) * 7)))
        d.line(pts, fill=(150, 52, 38), width=S(16), joint="curve")
        d.line(pts, fill=(226, 160, 132), width=S(4), joint="curve")


def onion_rings(im, cx, cy):
    d = ImageDraw.Draw(im)
    for dx in (-130, 0, 130):
        x = cx + dx
        d.ellipse([S(x - 64), S(cy - 22), S(x + 64), S(cy + 22)], outline=(214, 150, 62), width=S(14))


def arugula(im, cx, cy):
    d = ImageDraw.Draw(im)
    rnd = random.Random(11)
    for _ in range(22):
        x = cx + rnd.uniform(-RX + 10, RX - 10)
        y = cy + rnd.uniform(-RY + 10, RY - 10)
        d.ellipse([S(x - 26), S(y - 9), S(x + 26), S(y + 9)], fill=rnd.choice([(74, 120, 52), (96, 146, 66), (60, 100, 44)]))


def coalho(im, cx, cy):
    cylinder(im, cx, cy, RX - 10, RY - 4, 30, ((236, 196, 118), (220, 170, 90)), (196, 140, 70), (170, 116, 56))
    d = ImageDraw.Draw(im)
    for k in range(-3, 4):
        d.line([(S(cx + k * 60 - 40), S(cy - 30)), (S(cx + k * 60 + 40), S(cy - 2))], fill=(120, 70, 30), width=S(7))


def jalapenos(im, cx, cy):
    d = ImageDraw.Draw(im)
    rnd = random.Random(13)
    for i in range(9):
        x = cx + rnd.uniform(-RX + 30, RX - 30)
        y = cy + rnd.uniform(-RY + 14, RY - 14)
        col = (196, 46, 34) if i % 2 else (98, 150, 52)
        d.ellipse([S(x - 24), S(y - 10), S(x + 24), S(y + 10)], fill=col)
        d.ellipse([S(x - 8), S(y - 4), S(x + 8), S(y + 4)], fill=(236, 220, 160))


CLASSIC = [  # (desenho, altura no hambúrguer montado, espessura visual aproximada)
    ("bun_top", 0), ("sauce", 94), ("pickles", 104), ("onions", 116), ("cheddar", 128),
    ("patty", 150), ("cheddar2", 172), ("patty2", 192), ("bun_bottom", 232),
]
DRAW = {
    "bun_top": bun_top, "sauce": sauce, "pickles": pickles, "onions": onions,
    "cheddar": cheddar, "cheddar2": lambda im, cx, cy: cheddar(im, cx, cy, drips=False),
    "patty": patty, "patty2": lambda im, cx, cy: patty(im, cx, cy, seed=4), "bun_bottom": bun_bottom,
}


def burger_frame(t, alpha=False, layers=CLASSIC, draw=DRAW, cx=800, crumbs=True):
    im = canvas(alpha)
    n = len(layers)
    assembled_top = 450 - 150  # o centro visual do lanche montado fica em ~450
    exploded = np.linspace(172, 800, n)
    ys = []
    for k, (_, off) in enumerate(layers):
        a = assembled_top + off
        delay = 0.18 * abs(k - (n - 1) / 2) / ((n - 1) / 2)
        p = ease((t - (0.18 - delay)) / 0.82)
        ys.append(a + (exploded[k] - a) * p)
    # partículas (migalhas e gergelim) entre as camadas
    if crumbs and t > 0.15:
        rnd = random.Random(21)
        d = ImageDraw.Draw(im)
        for i in range(70):
            bx = cx + rnd.uniform(-330, 330)
            by = rnd.uniform(140, 790)
            drift = (t - 0.15) * rnd.uniform(-30, 30)
            s = rnd.uniform(2, 5)
            col = rnd.choice([(246, 228, 188), (190, 110, 50), (120, 70, 36)])
            op = int(255 * ease((t - 0.15) / 0.4))
            d.ellipse([S(bx + drift - s), S(by - drift * 0.6 - s * 0.6), S(bx + drift + s), S(by - drift * 0.6 + s * 0.6)], fill=col + (op,))
    # desenha de baixo para cima (camada de baixo primeiro) para a perspectiva ficar correta
    for k in range(n - 1, -1, -1):
        draw[layers[k][0]](im, cx, ys[k])
    return finish(im, alpha)


def variant(kind):
    if kind == "bacon":
        layers = [("bun_top", 0), ("bbq", 96), ("rings", 108), ("bacon", 122), ("cheddar", 136), ("patty", 158), ("bun_bottom", 206)]
        draw = dict(DRAW, bbq=lambda im, cx, cy: fill_poly(im, ellipse_pts(cx, cy, RX - 6, RY - 6, jitter=0.07, seed=8), (120, 40, 22), (96, 30, 16)),
                    rings=onion_rings, bacon=bacon, cheddar=lambda im, cx, cy: cheddar(im, cx, cy, color=(214, 132, 40)))
    elif kind == "coalho":
        layers = [("bun_top", 0), ("honey", 96), ("tomato", 108), ("arugula", 122), ("coalho", 146), ("bun_bottom", 196)]
        draw = dict(DRAW, honey=lambda im, cx, cy: fill_poly(im, ellipse_pts(cx, cy, RX - 40, RY - 14, jitter=0.1, seed=9), (240, 186, 60), (220, 160, 40)),
                    tomato=lambda im, cx, cy: pickles(im, cx, cy, color=((200, 52, 40), (230, 96, 70))), arugula=arugula, coalho=coalho)
    else:
        layers = [("bun_top", 0), ("chipotle", 94), ("jala", 106), ("pj", 120), ("patty", 142), ("pj2", 162), ("patty2", 184), ("bun_bottom", 226)]
        draw = dict(DRAW, bun_top=lambda im, cx, cy: bun_top(im, cx, cy, dark=True), bun_bottom=lambda im, cx, cy: bun_bottom(im, cx, cy, dark=True),
                    chipotle=lambda im, cx, cy: fill_poly(im, ellipse_pts(cx, cy, RX - 6, RY - 6, jitter=0.07, seed=10), (176, 60, 30), (150, 44, 22)),
                    jala=jalapenos, pj=lambda im, cx, cy: cheddar(im, cx, cy, color=(238, 222, 170)),
                    pj2=lambda im, cx, cy: cheddar(im, cx, cy, drips=False, color=(238, 222, 170)))
    return burger_frame(0, layers=layers, draw=draw, crumbs=False)


# ---------- chapa ----------
def chapa_frame(t):
    im = canvas()
    # superfície da chapa em perspectiva
    plate = [(S(-200), S(900)), (S(1800), S(900)), (S(1320), S(470)), (S(280), S(470))]
    fill_poly(im, plate, (26, 22, 20), (44, 38, 34))
    glow = Image.new("L", im.size, 0)
    ImageDraw.Draw(glow).ellipse([S(420), S(560), S(1180), S(800)], fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(S(60)))
    im.paste(Image.new("RGBA", im.size, (255, 120, 40, 255)), (0, 0), glow)
    d = ImageDraw.Draw(im)
    cx, base = 800, 680
    impact = 0.45
    if t < impact:
        # bolinha de carne
        r = 92
        d.ellipse([S(cx - r), S(base - 2 * r + 10), S(cx + r), S(base + 10)], fill=(150, 62, 48))
        speckle(im, cx, base - r + 10, r * 0.8, r * 0.8, (214, 140, 128), 120, 2, (2, 5))
        speckle(im, cx, base - r + 10, r * 0.8, r * 0.8, (110, 40, 30), 80, 3, (2, 4))
        press_y = 120 + (base - 2 * r - 30 - 120) * ease(t / impact)
    else:
        p = ease_out((t - impact) / 0.2)
        rx = 92 + (245 - 92) * p
        th = 60 - 36 * p
        col_top = tuple(int(a + (b - a) * p) for a, b in zip((150, 62, 48), (92, 50, 28)))
        cylinder(im, cx, base - th / 2, rx, rx * 0.22, th, (col_top, col_top), (70, 36, 20), (40, 20, 12), jitter=0.06 * p, seed=6)
        if t > 0.62:
            q = ease((t - 0.62) / 0.3)
            cheddar(im, cx, base - th - 4, drips=q > 0.5)
        press_y = base - 24 - 40 - (1 - ease_out((1 - t) / (1 - impact))) * 0 - ease((t - 0.6) / 0.4) * 200
        # faíscas de gordura no impacto
        if t < impact + 0.2:
            rnd = random.Random(31)
            k = (t - impact) / 0.2
            for _ in range(60):
                a = rnd.uniform(math.pi * 1.05, math.pi * 1.95)
                v = rnd.uniform(120, 420) * k
                x = cx + math.cos(a) * v
                y = base - 20 + math.sin(a) * v * 0.55 + 160 * k * k
                s = rnd.uniform(2, 4) * (1 - k * 0.6)
                d.ellipse([S(x - s), S(y - s), S(x + s), S(y + s)], fill=(255, 190, 90))
    # prensa
    press_y = max(60, press_y)
    d.rounded_rectangle([S(cx - 170), S(press_y), S(cx + 170), S(press_y + 34)], radius=S(8), fill=(176, 180, 186))
    d.rectangle([S(cx - 170), S(press_y + 26), S(cx + 170), S(press_y + 34)], fill=(120, 124, 130))
    d.rounded_rectangle([S(cx - 22), S(press_y - 120), S(cx + 22), S(press_y)], radius=S(10), fill=(40, 40, 44))
    # fumaça
    if t > impact:
        smoke = Image.new("L", im.size, 0)
        sd = ImageDraw.Draw(smoke)
        rnd = random.Random(41)
        for _ in range(9):
            x = cx + rnd.uniform(-260, 260)
            y = base - 80 - (t - impact) * rnd.uniform(200, 420)
            r = rnd.uniform(40, 90)
            sd.ellipse([S(x - r), S(y - r), S(x + r), S(y + r)], fill=int(60 * (1 - (t - impact))))
        smoke = smoke.filter(ImageFilter.GaussianBlur(S(30)))
        im.paste(Image.new("RGBA", im.size, (200, 190, 180, 255)), (0, 0), smoke)
    return finish(im)


# ---------- cheddar escorrendo ----------
def drip_frame(t):
    im = canvas()
    cx = 800
    # borda do hambúrguer no topo
    cylinder(im, cx, 60, 900, 80, 70, ((86, 50, 30), (64, 36, 22)), (52, 28, 16), (34, 18, 10), jitter=0.01, seed=2)
    d = ImageDraw.Draw(im)
    d.rectangle([0, S(96), S(W), S(124)], fill=(242, 168, 29))
    length = 60 + 1100 * ease(t)  # a gota estica e sai pela parte de baixo
    neck = max(8, 26 - 18 * ease(t))
    d.rounded_rectangle([S(cx - neck), S(110), S(cx + neck), S(110 + length)], radius=S(neck), fill=(242, 168, 29))
    r = 34 + 6 * math.sin(t * 6)
    d.ellipse([S(cx - r), S(110 + length - r * 1.6), S(cx + r), S(110 + length + r * 0.6)], fill=(250, 186, 50))
    hl = Image.new("L", im.size, 0)
    ImageDraw.Draw(hl).rounded_rectangle([S(cx - neck * 0.5), S(130), S(cx - neck * 0.1), S(110 + length - 20)], radius=S(4), fill=120)
    im.paste(Image.new("RGBA", im.size, (255, 236, 170, 255)), (0, 0), hl.filter(ImageFilter.GaussianBlur(S(3))))
    return finish(im)


def save(im, path, q=78):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=q, method=5)


if __name__ == "__main__":
    for name, n, fn in (("f1", N1, burger_frame), ("f2", N2, chapa_frame), ("f3", N3, drip_frame)):
        for i in range(n):
            save(fn(i / (n - 1)), OUT / f"seq/{name}/{i + 1:04d}.webp")
        print(name, n, "quadros")
    save(burger_frame(0), OUT / "img/g1.webp")
    burger_frame(0, alpha=True).save(OUT / "img/g1-cutout.webp", "WEBP", quality=85, method=5)
    save(burger_frame(1), OUT / "img/g2.webp")
    save(chapa_frame(1), OUT / "img/g4.webp")
    save(drip_frame(0.2), OUT / "img/g5.webp")
    for k, kind in (("g6", "bacon"), ("g7", "coalho"), ("g8", "duplo")):
        save(variant(kind), OUT / f"img/{k}.webp")
    print("imagens ok")
