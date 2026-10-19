"""QA visual: abre o site, rola por etapas e salva prints + folha de contato.

Uso: python3 scripts/qa.py http://127.0.0.1:4173/ qa desktop 20   (ou mobile)
Precisa de: pip install playwright pillow && python3 -m playwright install chromium
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

URL, OUT = sys.argv[1], Path(sys.argv[2])
MODE = sys.argv[3] if len(sys.argv) > 3 else "desktop"
N = int(sys.argv[4]) if len(sys.argv) > 4 else 24
OUT.mkdir(parents=True, exist_ok=True)
vp = {"width": 1440, "height": 900} if MODE == "desktop" else {"width": 390, "height": 844}

with sync_playwright() as p:
    import os
    exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
    kw = {"executable_path": exe} if os.path.exists(exe) else {}
    b = p.chromium.launch(args=["--enable-webgl", "--ignore-gpu-blocklist"], **kw)
    ctx = b.new_context(viewport=vp, device_scale_factor=1, is_mobile=MODE != "desktop", has_touch=MODE != "desktop")
    pg = ctx.new_page()
    logs = []
    pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
    pg.goto(URL, wait_until="load")
    pg.wait_for_timeout(4200)
    total = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
    shots = []
    for i in range(N):
        y = round(total * i / (N - 1))
        pg.evaluate(f"(window.__lenis ? window.__lenis.scrollTo({y}, {{immediate: true}}) : window.scrollTo(0, {y}))")
        pg.wait_for_timeout(1300)
        f = OUT / f"{MODE}-{i:02d}.png"
        pg.screenshot(path=str(f))
        shots.append((f, y))
    print("scroll total", total)
    print("\n".join(logs[:30]) or "sem erros no console")
    b.close()

w, h = (360, 225) if MODE == "desktop" else (195, 422)
cols = 4 if MODE == "desktop" else 6
rows = (len(shots) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (w + 8), rows * (h + 24)), "white")
d = ImageDraw.Draw(sheet)
for k, (f, y) in enumerate(shots):
    im = Image.open(f).convert("RGB").resize((w, h))
    x0, y0 = (k % cols) * (w + 8), (k // cols) * (h + 24)
    sheet.paste(im, (x0, y0 + 20))
    d.text((x0 + 4, y0 + 4), f"{k}: y={y}", fill="black")
sheet.save(OUT / f"sheet-{MODE}.png")
