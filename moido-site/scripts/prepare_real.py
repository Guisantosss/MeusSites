"""Troca o material provisório pelo real (Gemini + Flow) e mede tudo sozinho.

Uso:  python3 scripts/prepare_real.py <pasta com os arquivos reais>

Espera os nomes do guia: g1-montado.png, g2-camadas.png, g4-chapa-depois.png, g5-cheddar.png,
g6-bacon-brasa.png, g7-coalho-na-brasa.png, g8-duplo-inferno.png, f1-abrir.mp4, f2-prensa.mp4, f3-cheddar.mp4.
O que estiver faltando continua provisório.

O que ele faz:
  1. Extrai os quadros de cada clipe (WebP, 1600 px, no máximo 120/96/72 quadros), cortando 0,15 s das pontas
     (ou o trecho de TRIM), e gera o conjunto leve do celular em seq/<clipe>-m.
  2. Mede a cor real do fundo (mediana das bordas) de cada sequência.
  3. Recorta o fundo da G1 (preenchimento a partir das bordas) e salva img/g1-cutout.webp com transparência.
  4. Mede onde o hambúrguer está na G1 (centro e altura) para centralizar a abertura.
  5. Reescreve src/config.ts com as contagens, tamanhos e cores medidos.
Depois disso, ajuste só LABEL_ANCHORS olhando a última imagem do F1.
"""
import json
import re
import shutil
import subprocess
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
CFG = ROOT / "src/config.ts"
WIDTH = 1600
QUALITY = 62
MAXF = {"f1": 120, "f2": 96, "f3": 72}
# Celular: metade dos quadros e mais leves. Nos clipes "cover" só o miolo aparece com o celular em pé, então o
# conjunto do celular guarda só o centro (fração da largura). Igual ao `mobileCrop` de src/config.ts.
MOBILE = {"f1": {"crop": 1.0, "width": 1100}, "f2": {"crop": 0.5, "width": 800}, "f3": {"crop": 0.5, "width": 800}}
CLIPS = {"f1": "f1-abrir.mp4", "f2": "f2-prensa.mp4", "f3": "f3-cheddar.mp4"}
# Trecho usado de cada clipe (início e fim, em segundos). Sem entrada: corta 0,15 s das pontas.
# F2: o clipe do Flow termina com a prensa descendo de novo (7,4 s); paramos no hambúrguer com cheddar.
TRIM = {"f2": (0.15, 7.3)}
IMGS = {"g1": "g1-montado", "g2": "g2-camadas", "g3": "g3-chapa-antes", "g4": "g4-chapa-depois", "g5": "g5-cheddar",
        "g6": "g6-bacon-brasa", "g7": "g7-coalho-na-brasa", "g8": "g8-duplo-inferno"}


def find_img(stem):
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        if (SRC / (stem + ext)).exists():
            return SRC / (stem + ext)
    return None


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height:format=duration", "-of", "json", str(path)], capture_output=True, text=True, check=True)
    j = json.loads(out.stdout)
    return j["streams"][0]["width"], j["streams"][0]["height"], float(j["format"]["duration"])


def border_color(im):
    a = np.asarray(im.convert("RGB")).astype(int)
    h, w, _ = a.shape
    k = max(4, min(h, w) // 40)
    edge = np.concatenate([a[:k].reshape(-1, 3), a[-k:].reshape(-1, 3), a[:, :k].reshape(-1, 3), a[:, -k:].reshape(-1, 3)])
    return tuple(int(v) for v in np.median(edge, axis=0))


def hexc(c):
    return "#{:02X}{:02X}{:02X}".format(*c)


def extract(name):
    clip = SRC / CLIPS[name]
    if not clip.exists():
        return None
    w, h, dur = probe(clip)
    trim = 0.15 if dur > 2 else 0
    start, end = TRIM.get(name, (trim, dur - trim))
    length = min(end, dur) - start
    n = min(MAXF[name], int(length * 24))
    fps = n / length
    out = PUB / "seq" / name
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    tw = min(WIDTH, w)
    subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{start}", "-t", f"{length}", "-i", str(clip),
                    "-vf", f"fps={fps:.5f},scale={tw}:-2:flags=lanczos", "-c:v", "libwebp", "-quality", str(QUALITY),
                    "-compression_level", "5", str(out / "%04d.webp")], check=True)
    frames = sorted(out.glob("*.webp"))
    first = Image.open(frames[0])
    bg = border_color(first)
    size = sum(f.stat().st_size for f in frames) / 1e6
    print(f"{name}: {len(frames)} quadros {first.size[0]}x{first.size[1]}, fundo {hexc(bg)}, {size:.1f} MB")
    mobile_set(name)
    return {"count": len(frames), "width": first.size[0], "height": first.size[1], "bg": hexc(bg)}


def mobile_set(name):
    """Gera seq/<name>-m a partir dos quadros do desktop: um sim, outro não, só o miolo e menores."""
    src = sorted((PUB / "seq" / name).glob("*.webp"))
    out = PUB / "seq" / f"{name}-m"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    m = MOBILE[name]
    for k, f in enumerate(src[::2]):
        im = Image.open(f).convert("RGB")
        w, h = im.size
        cw = round(w * m["crop"])
        x0 = (w - cw) // 2
        tw = min(m["width"], cw)
        im = im.crop((x0, 0, x0 + cw, h)).resize((tw, round(h * tw / cw)), Image.LANCZOS)
        im.save(out / f"{k + 1:04d}.webp", "WEBP", quality=QUALITY, method=5)
    size = sum(p.stat().st_size for p in out.glob("*.webp")) / 1e6
    print(f"{name}-m: {len(src[::2])} quadros {im.size[0]}x{im.size[1]} (celular), {size:.1f} MB")


def cutout(img):
    """Fundo = região conectada às bordas com cor parecida com a da borda. Devolve RGBA."""
    rgb = np.asarray(img.convert("RGB")).astype(int)
    h, w, _ = rgb.shape
    bg = np.array(border_color(img))
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    near = dist < 28
    mask = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not mask[y, x]:
                mask[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not mask[y, x]:
                mask[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True; q.append((ny, nx))
    alpha = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8))
    from PIL import ImageFilter
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))  # borda macia
    out = img.convert("RGBA")
    out.putalpha(alpha)
    a = np.asarray(alpha) > 128
    ys, xs = np.where(a)
    box = (xs.min() / w, ys.min() / h, xs.max() / w, ys.max() / h)
    return out, box


def main():
    cfg = CFG.read_text(encoding="utf-8")
    for name in ("f1", "f2", "f3"):
        info = extract(name)
        if not info:
            print(f"{name}: clipe não encontrado, continua provisório")
            continue
        pat = re.compile(rf'({name}: \{{ dir: "seq/{name}", )count: \d+, width: \d+, height: \d+, bg: "#[0-9A-Fa-f]+"')
        cfg = pat.sub(rf'\g<1>count: {info["count"]}, width: {info["width"]}, height: {info["height"]}, bg: "{info["bg"]}"', cfg)

    (PUB / "img").mkdir(parents=True, exist_ok=True)
    for key, fname in IMGS.items():
        p = find_img(fname)
        if not p:
            print(f"{key}: imagem não encontrada, continua provisória")
            continue
        im = Image.open(p).convert("RGB")
        if im.size[0] > WIDTH:
            im = im.resize((WIDTH, round(im.size[1] * WIDTH / im.size[0])), Image.LANCZOS)
        im.save(PUB / f"img/{key}.webp", "WEBP", quality=80, method=5)
        if key == "g1":
            cut, box = cutout(im)
            cut.save(PUB / "img/g1-cutout.webp", "WEBP", quality=85, method=5)
            cy, hh = (box[1] + box[3]) / 2, box[3] - box[1]
            cfg = re.sub(r"export const HERO_BURGER = \{ cy: [\d.]+, h: [\d.]+ \};",
                         f"export const HERO_BURGER = {{ cy: {cy:.3f}, h: {hh:.3f} }};", cfg)
            print(f"g1: hambúrguer entre y={box[1]:.2f} e y={box[3]:.2f} do quadro; recorte salvo")
        print(f"{key}: ok")
    CFG.write_text(cfg, encoding="utf-8")
    print("src/config.ts atualizado. Confira os rótulos (LABEL_ANCHORS) na última imagem de seq/f1.")


if __name__ == "__main__":
    main()
