// Extrai os quadros dos vídeos de midia/videos (que nunca é alterada) para public/frames/ e escreve o manifest.json.
//   desktop: 12 fps, largura 1600 (ou a original, se o vídeo for menor: T3/T4 em 720p ficam em 1280), WebP 80
//   mobile:  12 fps, recorte quadrado central, 800x800, WebP 74
// (qualidade acima da sugestão do plano, ~70/65: ainda dentro da meta de peso e com menos faixas no degradê da luz)
// Emendas: o último quadro de cada clipe sempre entra e o primeiro do clipe seguinte (repetido) sai, para o filme
// não pular entre as cenas. A T4 termina no quadro 90 (3,75 s), que é o mesmo quadro que abre a T5.
// Cena sem vídeo (a T5, por enquanto) fica fora do manifest: o site usa a fusão provisória só nela.
// Uso: npm run frames            (opções: --fps 10   --q 70,65   --only t3)
// Quando chegar o T5_xicara.mp4 (ou as versões 1080p da T3/T4, com o mesmo nome), é só rodar de novo.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES } from "../src/config/scenes.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VIDEOS = join(ROOT, "midia", "videos");
const OUT = join(ROOT, "public", "frames");
const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const FPS = Number(opt("--fps", 12));
const [Q_DESKTOP, Q_MOBILE] = opt("--q", "80,74").split(",").map(Number);
const ONLY = opt("--only", null);
const BUDGET_MB = { desktop: 20, mobile: 12 };

const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { encoding: "utf8" });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} falhou:\n${r.stderr}`);
  return r.stdout;
};

if (spawnSync("ffmpeg", ["-version"]).error || spawnSync("ffprobe", ["-version"]).error) {
  console.error("ffmpeg/ffprobe não encontrados. No Windows, instale com: winget install ffmpeg");
  process.exit(1);
}

function probe(file) {
  const j = JSON.parse(run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames",
    "-show_entries", "stream=width,height,r_frame_rate,nb_read_frames", "-of", "json", file]));
  const s = j.streams[0];
  const [a, b] = s.r_frame_rate.split("/").map(Number);
  return { width: s.width, height: s.height, fps: a / b, frames: Number(s.nb_read_frames) };
}

const dirKB = (dir) => readdirSync(dir).reduce((sum, f) => sum + statSync(join(dir, f)).size, 0) / 1024;

const manifest = { version: 1, fps: FPS, generated: new Date().toISOString(), scenes: {} };
const totals = { desktop: 0, mobile: 0 };
let prevHadVideo = false;

for (const scene of SCENES) {
  const file = join(VIDEOS, `${scene.video}.mp4`);
  if (!existsSync(file)) {
    console.log(`${scene.id}: ${scene.video}.mp4 não existe -> fica no modo provisório (fusão)`);
    prevHadVideo = false;
    continue;
  }
  const info = probe(file);
  const step = Math.max(1, Math.round(info.fps / (scene.fps ?? FPS)));
  const last = scene.cutAt ? Math.round(scene.cutAt * info.fps) : info.frames - 1; // índice do último quadro usado
  const skipFirst = prevHadVideo; // o primeiro quadro repete o último da cena anterior
  prevHadVideo = true;
  // quadros a cada `step`, mais o último; nada depois do corte; sem o primeiro se for emenda
  let expr = `(not(mod(n\\,${step}))+eq(n\\,${last}))*lte(n\\,${last})`;
  if (skipFirst) expr += "*gt(n\\,0)";
  const seconds = (last + 1) / info.fps;

  const versions = {
    desktop: { vf: `scale=${Math.min(1600, info.width)}:-2:flags=lanczos`, q: Q_DESKTOP },
    mobile: { vf: "crop=ih:ih,scale=800:800:flags=lanczos", q: Q_MOBILE },
  };
  const entry = { video: scene.video, sourceFps: info.fps, step, lastSourceFrame: last, skipFirst, seconds };
  for (const [v, { vf, q }] of Object.entries(versions)) {
    const dir = join(OUT, v, scene.id);
    if (ONLY && ONLY !== scene.id) {
      // mantém o que já existe
      const prev = existsSync(dir) ? readdirSync(dir).length : 0;
      entry[v] = { count: prev };
      totals[v] += prev ? dirKB(dir) : 0;
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    run("ffmpeg", ["-v", "error", "-y", "-i", file, "-an", "-vf", `select='${expr}',${vf}`, "-fps_mode", "passthrough",
      "-c:v", "libwebp", "-quality", String(q), "-compression_level", "6", "-start_number", "1", join(dir, "%03d.webp")]);
    const frames = readdirSync(dir).filter((f) => f.endsWith(".webp"));
    const p = probe(join(dir, "001.webp"));
    const kb = dirKB(dir);
    totals[v] += kb;
    entry[v] = { count: frames.length, width: p.width, height: p.height, kb: Math.round(kb) };
  }
  manifest.scenes[scene.id] = entry;
  console.log(`${scene.id}: ${entry.desktop.count} quadros (${entry.desktop.width}x${entry.desktop.height}, ${(entry.desktop.kb / 1024).toFixed(1)} MB)` +
    ` | celular ${entry.mobile.count} (${(entry.mobile.kb / 1024).toFixed(1)} MB)` +
    `${skipFirst ? " | sem o 1º quadro (emenda)" : ""}${scene.cutAt ? ` | cortada em ${scene.cutAt} s (quadro ${last})` : ""}`);
}

manifest.bytes = { desktop: Math.round(totals.desktop * 1024), mobile: Math.round(totals.mobile * 1024) };
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

for (const v of ["desktop", "mobile"]) {
  const mb = totals[v] / 1024;
  const ok = mb <= BUDGET_MB[v];
  console.log(`${v}: ${mb.toFixed(1)} MB (meta até ${BUDGET_MB[v]} MB) ${ok ? "ok" : "ACIMA DA META: tente --fps 10 ou --q 65,60"}`);
}
console.log(`manifest: ${join("public", "frames", "manifest.json")}`);
