"""Gera public/img/og.jpg (1200x630) a partir de scripts/og.html. Uso: python scripts/og.py (precisa do Playwright)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome")
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    pg.goto((ROOT / "scripts" / "og.html").as_uri())
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(400)
    out = ROOT / "public" / "img" / "og.jpg"
    pg.screenshot(path=str(out), type="jpeg", quality=88)
    b.close()
print(f"ok: {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")
