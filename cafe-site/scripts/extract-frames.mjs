// Extrai os quadros dos vídeos de midia/videos (que nunca é alterada) e empacota em public/frames/ + manifest.json.
//   desktop: 12 fps, largura 1600 (ou a original, se o vídeo for menor: T3/T4 em 720p ficam em 1280), WebP 80
//   mobile:  12 fps, recorte quadrado central, 800x800, WebP 74
// (qualidade acima da sugestão do plano, ~70/65: ainda dentro da meta de peso e com menos faixas no degradê da luz)
// Emendas: o último quadro de cada clipe sempre entra e o primeiro do clipe seguinte (repetido) sai, para o filme
// não pular entre as cenas. A T4 termina no quadro 90 (3,75 s), que é o mesmo quadro que abre a T5.
// Cena sem vídeo (a T5, por enquanto) fica fora do manifest: o site usa a fusão provisória só nela.
//
// Pacotes: em vez de ~380 arquivos (um pedido de rede por quadro, caro para a linha principal do navegador),
// cada modo tem 5 arquivos: heads.pack (o 1º quadro de cada cena, para a primeira tela) e um <cena>.pack por cena,
// com os quadros na ordem do grosso para o fino (1 a cada 8, depois 4, 2, 1). Lidos aos poucos (streaming), o filme
// inteiro fica navegável cedo. O manifest guarda onde cada quadro começa e quantos bytes tem.
//
// Uso: npm run frames            (opções: --fps 10   --q 70,65)
// Quando chegar o T5_xicara.mp4 (ou a T3/T4 em 1080p, com o mesmo nome), é só rodar de novo.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES } from "../src/config/scenes.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VIDEOS = join(ROOT, "midia", "videos");
const OUT = join(ROOT, "public", "frames");
const WORK = join(ROOT, ".frames-work"); // quadros soltos, só para montar os pacotes (fora do Git)
const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const FPS = Number(opt("--fps", 12));
const [Q_DESKTOP, Q_MOBILE] = opt("--q", "80,74").split(",").map(Number);
const BUDGET_MB = { desktop: 20, mobile: 12 };
const MODES = ["desktop", "mobile"];

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

/** Ordem dentro do pacote: do grosso para o fino (sem o quadro 0, que vai no heads.pack); o último entra cedo. */
function packOrder(count) {
  const order = [];
  const seen = new Set([0]);
  const push = (i) => {
    if (i >= 0 && i < count && !seen.has(i)) {
      seen.add(i);
      order.push(i);
    }
  };
  for (let i = 0; i < count; i += 8) push(i);
  push(count - 1);
  for (const stride of [4, 2, 1]) for (let i = 0; i < count; i += stride) push(i);
  return order;
}

const manifest = { version: 2, fps: FPS, generated: new Date().toISOString(), scenes: {}, packs: {} };
const files = { desktop: {}, mobile: {} }; // cena -> lista de caminhos dos quadros (índice 0 = 1º quadro)
let prevHadVideo = false;

rmSync(WORK, { recursive: true, force: true });
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

  const versions = {
    desktop: { vf: `scale=${Math.min(1600, info.width)}:-2:flags=lanczos`, q: Q_DESKTOP },
    mobile: { vf: "crop=ih:ih,scale=800:800:flags=lanczos", q: Q_MOBILE },
  };
  const entry = { video: scene.video, sourceFps: info.fps, step, lastSourceFrame: last, skipFirst, seconds: (last + 1) / info.fps };
  for (const [v, { vf, q }] of Object.entries(versions)) {
    const dir = join(WORK, v, scene.id);
    mkdirSync(dir, { recursive: true });
    run("ffmpeg", ["-v", "error", "-y", "-i", file, "-an", "-vf", `select='${expr}',${vf}`, "-fps_mode", "passthrough",
      "-c:v", "libwebp", "-quality", String(q), "-compression_level", "6", "-start_number", "1", join(dir, "%03d.webp")]);
    const list = readdirSync(dir).filter((f) => f.endsWith(".webp")).sort().map((f) => join(dir, f));
    const p = probe(list[0]);
    files[v][scene.id] = list;
    entry[v] = { count: list.length, width: p.width, height: p.height };
  }
  manifest.scenes[scene.id] = entry;
  console.log(`${scene.id}: ${entry.desktop.count} quadros (${entry.desktop.width}x${entry.desktop.height}) | celular ${entry.mobile.count}` +
    `${skipFirst ? " | sem o 1º quadro (emenda)" : ""}${scene.cutAt ? ` | cortada em ${scene.cutAt} s (quadro ${last})` : ""}`);
}

// pacotes: limpa só o que este script cria (pastas de quadros soltos da versão antiga e os .pack)
for (const v of MODES) {
  const dir = join(OUT, v);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ids = Object.keys(files[v]);
  const write = (name, items) => {
    // items: [{ key, path }] -> grava o pacote e devolve [chave..., início, tamanho]
    const parts = [];
    const index = [];
    let offset = 0;
    for (const { key, path } of items) {
      const buf = readFileSync(path);
      parts.push(buf);
      index.push([...key, offset, buf.length]);
      offset += buf.length;
    }
    writeFileSync(join(dir, name), Buffer.concat(parts));
    return { file: name, bytes: offset, entries: index };
  };
  const heads = write("heads.pack", ids.map((id) => ({ key: [id, 0], path: files[v][id][0] })));
  const scenes = {};
  for (const id of ids) {
    const order = packOrder(files[v][id].length);
    scenes[id] = write(`${id}.pack`, order.map((i) => ({ key: [i], path: files[v][id][i] })));
  }
  manifest.packs[v] = { heads, scenes };
  const mb = (heads.bytes + Object.values(scenes).reduce((s, p) => s + p.bytes, 0)) / 1048576;
  manifest.packs[v].mb = Number(mb.toFixed(2));
  console.log(`${v}: ${mb.toFixed(1)} MB em ${ids.length + 1} arquivos (meta até ${BUDGET_MB[v]} MB) ${mb <= BUDGET_MB[v] ? "ok" : "ACIMA DA META: tente --fps 10 ou --q 65,60"}`);
}
rmSync(WORK, { recursive: true, force: true });
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest) + "\n");
console.log(`manifest: ${join("public", "frames", "manifest.json")}`);
