// Gera as imagens-chave otimizadas do modo provisório a partir de midia/keyframes (que nunca é alterada).
//   desktop: largura original (1920), WebP
//   mobile:  recorte quadrado central (o objeto está sempre no centro) em 800x800, WebP
// Uso: npm run keyframes
import { spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "midia", "keyframes");
const OUT = join(ROOT, "public", "img", "keyframes");
const KEYS = ["K0_cereja", "K1_cereja_aberta", "K2_grao_verde", "K3_grao_torrado", "K4b_nuvem_inicio_T5", "K4c_portafiltro", "K5_xicara"];

const VERSOES = {
  desktop: { vf: "scale=1920:-2:flags=lanczos", quality: 82 },
  mobile: { vf: "crop=ih:ih,scale=800:800:flags=lanczos", quality: 80 },
};

if (spawnSync("ffmpeg", ["-version"]).error) {
  console.error("ffmpeg não encontrado. No Windows, instale com: winget install ffmpeg");
  process.exit(1);
}

let total = 0;
for (const [versao, { vf, quality }] of Object.entries(VERSOES)) {
  mkdirSync(join(OUT, versao), { recursive: true });
  for (const k of KEYS) {
    const out = join(OUT, versao, `${k}.webp`);
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", join(SRC, `${k}.jpg`), "-vf", vf,
      "-c:v", "libwebp", "-quality", String(quality), "-compression_level", "6", out], { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
    const kb = statSync(out).size / 1024;
    total += kb;
    console.log(`${versao.padEnd(7)} ${k.padEnd(20)} ${kb.toFixed(0).padStart(4)} KB`);
  }
}
console.log(`total: ${(total / 1024).toFixed(2)} MB`);
