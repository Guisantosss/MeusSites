"""Sequências PROVISÓRIAS feitas das fotos reais, enquanto os clipes do Flow não chegam.

F1: o hambúrguer "abre" usando as camadas recortadas da G2 (começa na G1 e termina exatamente na G2).
F2: G3 -> G4 com um empurrão de câmera e a troca no momento da prensa.
F3: aproximação lenta na G5.

Uso: python3 scripts/interim.py <pasta com as fotos> [f1 f2 f3]  (nomes do guia, .jpg/.png)
     Sem a lista, gera as três. Ex.: só o plano B do F1 -> python3 scripts/interim.py assets/raw f1
Também serve de plano B se algum clipe do Flow não ficar bom.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

sys.path.insert(0, str(Path(__file__).parent))
import prepare_real as P  # noqa: E402

SRC = Path(sys.argv[1])
PUB = Path(__file__).resolve().parent.parent / "public"
P.SRC = SRC


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def smooth(a, b, t):
    return ease((t - a) / (b - a))


MAXW = 1600


def save(im, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im = im.convert("RGB")
    if im.width > MAXW:
        im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
    im.save(path, "WEBP", quality=72, method=5)


def clear(dirname):
    d = PUB / "seq" / dirname
    d.mkdir(parents=True, exist_ok=True)
    for f in d.glob("*.webp"):
        f.unlink()
    return d


def zoom(im, s, cy=0.5, dy=0.0):
    """Aproxima a imagem (s >= 1) mantendo o tamanho, centro vertical em cy."""
    w, h = im.size
    cw, ch = w / s, h / s
    x0 = (w - cw) / 2
    y0 = min(max(0, h * cy - ch / 2 + dy * h), h - ch)
    return im.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).resize((w, h), Image.LANCZOS)


# ---------- F1: abrir o hambúrguer com as camadas da G2 ----------
def f1(n=96):
    g1 = Image.open(P.find_img("g1-montado")).convert("RGB")
    g2 = Image.open(P.find_img("g2-camadas")).convert("RGB")
    W, H = g2.size
    bg = P.border_color(g2)
    cut, box2 = P.cutout(g2)
    _, box1 = P.cutout(g1)
    rgba = np.asarray(cut)

    # cortes entre camadas: mínimos do perfil de cobertura por linha
    d = np.sqrt(((np.asarray(g2).astype(int) - np.array(bg)) ** 2).sum(2))
    x0, x1 = int(box2[0] * W), int(box2[2] * W)
    frac = (d[:, x0:x1] > 40).mean(1)
    top, bot = int(box2[1] * H) - 2, int(box2[3] * H) + 2
    k = H / 768  # parâmetros pensados para 768 px de altura, escalados para o tamanho real
    win_n, step, min_band, refine, sliver = round(40 * k), round(20 * k), round(35 * k), round(16 * k), round(24 * k)
    smooth_frac = np.convolve(frac, np.ones(max(3, round(5 * k))) / max(3, round(5 * k)), mode="same")
    cuts = [top]
    y = top + round(30 * k)
    while y < bot - round(30 * k):
        win = smooth_frac[y:y + win_n]
        j = int(np.argmin(win))
        if win[j] < 0.5 and y + j - cuts[-1] > min_band:
            c = y + j
            lo, hi = max(c - refine, cuts[-1] + min_band // 2), min(c + refine, bot - 1)
            c = lo + int(np.argmin(smooth_frac[lo:hi]))  # assenta no ponto mais vazio por perto
            if c - cuts[-1] > min_band:
                cuts.append(c)
            y = c + round(30 * k)
        else:
            y += step
    if bot - cuts[-1] < sliver:
        cuts[-1] = bot  # junta uma lasca final com a camada de cima
    else:
        cuts.append(bot)
    bands = []
    for a, b in zip(cuts[:-1], cuts[1:]):
        layer = np.zeros_like(rgba)
        layer[a:b] = rgba[a:b]
        bands.append((a, b, Image.fromarray(layer, "RGBA")))
    print("F1: camadas", [(a, b) for a, b, _ in bands])

    w1 = (box1[2] - box1[0]) * W
    w2 = (box2[2] - box2[0]) * W
    s0 = w1 / w2  # escala da G2 que bate com a largura da G1
    c1 = ((box1[0] + box1[2]) / 2 * W, (box1[1] + box1[3]) / 2 * H)
    c2 = ((box2[0] + box2[2]) / 2 * W, (box2[1] + box2[3]) / 2 * H)
    heights = [b - a for a, b, _ in bands]
    h1 = (box1[3] - box1[1]) * H
    target = h1 / s0
    ov = max(0.0, (sum(heights) - target) / max(1, len(bands) - 1))
    stack_top = c2[1] - target / 2
    assembled, acc = [], stack_top
    for hgt in heights:
        assembled.append(acc)
        acc += hgt - ov

    out = clear("f1")
    nb = len(bands)
    for i in range(n):
        t = i / (n - 1)
        frame = Image.new("RGBA", (W, H), bg + (255,))
        if t >= 0.94:
            frame = g2.convert("RGBA")
        else:
            pg = smooth(0.1, 0.92, t)
            S = s0 + (1 - s0) * pg
            cx = c1[0] + (c2[0] - c1[0]) * pg
            cy = c1[1] + (c2[1] - c1[1]) * pg
            for k in range(nb - 1, -1, -1):  # de baixo para cima
                a, b, layer = bands[k]
                delay = 0.12 * abs(k - (nb - 1) / 2) / ((nb - 1) / 2)
                pk = smooth(0.1 + 0.12 - delay, 0.92, t)
                ytop = assembled[k] + (a - assembled[k]) * pk  # topo da faixa no espaço da G2
                band = layer.crop((0, a, W, b))
                bw, bh = round(W * S), max(1, round((b - a) * S))
                band = band.resize((bw, bh), Image.LANCZOS)
                px = round(cx - c2[0] * S)
                py = round(cy + (ytop - c2[1]) * S)
                frame.alpha_composite(band, (px, py)) if 0 <= px and py >= 0 and px + bw <= W and py + bh <= H else frame.paste(band, (px, py), band)
            fade = 1 - smooth(0.05, 0.2, t)
            if fade > 0:
                frame = Image.blend(frame, g1.convert("RGBA"), fade)
        save(frame, out / f"{i + 1:04d}.webp")
    return {"count": n, "width": min(W, MAXW), "height": round(H * min(W, MAXW) / W), "bg": P.hexc(bg), "box1": box1, "box2": box2}


# ---------- F2: prensa ----------
def f2(n=72, impact=0.45):
    a = Image.open(P.find_img("g3-chapa-antes")).convert("RGB")
    b = Image.open(P.find_img("g4-chapa-depois")).convert("RGB")
    out = clear("f2")
    for i in range(n):
        t = i / (n - 1)
        if t < impact - 0.06:
            im = zoom(a, 1 + 0.05 * ease(t / (impact - 0.06)))
        elif t < impact + 0.04:
            k = (t - (impact - 0.06)) / 0.1
            im = Image.blend(zoom(a, 1.05), zoom(b, 1.05 - 0.04 * k), ease(k))
            im = ImageEnhance.Brightness(im).enhance(1 + 0.12 * (1 - abs(2 * k - 1)))
        else:
            im = zoom(b, 1.01 + 0.05 * ease((t - impact - 0.04) / (1 - impact - 0.04)))
        save(im, out / f"{i + 1:04d}.webp")
    return {"count": n, "width": min(a.size[0], MAXW), "height": round(a.size[1] * min(a.size[0], MAXW) / a.size[0]), "bg": P.hexc(P.border_color(a))}


# ---------- F3: cheddar ----------
def f3(n=40):
    a = Image.open(P.find_img("g5-cheddar")).convert("RGB")
    out = clear("f3")
    for i in range(n):
        t = i / (n - 1)
        save(zoom(a, 1 + 0.16 * ease(t), cy=0.62, dy=0.04 * ease(t)), out / f"{i + 1:04d}.webp")
    return {"count": n, "width": min(a.size[0], MAXW), "height": round(a.size[1] * min(a.size[0], MAXW) / a.size[0]), "bg": P.hexc(P.border_color(a))}


if __name__ == "__main__":
    import json
    which = sys.argv[2:] or ["f1", "f2", "f3"]
    info = {}
    for k in which:
        info[k] = {"f1": f1, "f2": f2, "f3": f3}[k]()
        P.mobile_set(k)  # conjunto leve do celular (seq/<k>-m)
    print(json.dumps({k: {kk: (vv if not isinstance(vv, tuple) else [round(float(x), 4) for x in vv]) for kk, vv in v.items()} for k, v in info.items()}, indent=1))
