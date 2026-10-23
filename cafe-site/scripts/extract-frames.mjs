// Extrai os quadros dos vídeos de midia/videos (que nunca é alterada) e empacota em public/frames/ + manifest.json.
//   desktop: 12 fps, largura 1600 (ou a original, se o vídeo for menor), WebP
//   mobile:  12 fps, recorte quadrado central, 760x760, WebP (o plano sugeria 800: com as 6 cenas em 1080p passava da
//            meta de 12 MB; a qualidade quase não mudava o peso, os pixels sim. 760 cobre a tela do filme no celular)
// Emendas: o último quadro de cada clipe sempre entra e o primeiro do clipe seguinte (repetido) sai, para o filme
// não pular entre as cenas. A T4 termina no quadro 90 (3,75 s), que é o mesmo quadro que abre a T5a.
// ⚠️ Corte da T4 (`cutAt` em scenes.js): corta por tempo na entrada (-t, antes de qualquer filtro) E pelo número do
// quadro; depois do quadro 90 o grão se remonta ("explode e desexplode"). Vale para as duas versões. No fim, a
// prancha scripts/check/t4_sheet.jpg mostra todos os quadros usados da T4 e a K4b, para conferir com os olhos.
// Cena sem vídeo fica fora do manifest: o site usa a fusão provisória só nela.
//
// Pacotes: em vez de ~380 arquivos (um pedido de rede por quadro, caro para a linha principal do navegador),
// cada modo tem 5 arquivos: heads.pack (o 1º quadro de cada cena, para a primeira tela) e um <cena>.pack por cena,
// com os quadros na ordem do grosso para o fino (1 a cada 8, depois 4, 2, 1). Lidos aos poucos (streaming), o filme
// inteiro fica navegável cedo. O manifest guarda onde cada quadro começa e quantos bytes tem.
//
// Uso: npm run frames            (opções: --fps 10   --q 70,65)
// Vídeo novo com o mesmo nome em midia/videos: é só rodar de novo.
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
// notebook na qualidade sugerida no plano (70); celular um pouco abaixo dos 65 sugeridos, para caber na meta de peso
// com as 6 cenas em 1080p (o plano manda baixar a qualidade se passar)
const [Q_DESKTOP, Q_MOBILE] = opt("--q", "70,62").split(",").map(Number);
const BUDGET_MB = { desktop: 20, mobile: 12 };
const MOBILE_SIZE = 760;
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

/** Prancha de conferência de uma cena cortada: grade com todos os quadros usados e, embaixo, o último quadro (à
 *  esquerda) ao lado da imagem-chave em que ele tem de terminar (à direita). Fica em scripts/check/<cena>_sheet.jpg. */
function checkSheet(scene, list) {
  const dir = join(ROOT, "scripts", "check");
  mkdirSync(dir, { recursive: true });
  const cols = 10;
  const rows = Math.ceil(list.length / cols);
  const gridW = cols * 240 + (cols - 1) * 4;
  const half = Math.floor((gridW - 4) / 2);
  const out = join(dir, `${scene.id}_sheet.jpg`);
  run("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", join(dirname(list[0]), "%03d.webp"),
    "-i", list.at(-1), "-i", join(ROOT, "midia", "keyframes", `${scene.to}.jpg`), "-filter_complex",
    `[0]scale=240:-2,tile=${cols}x${rows}:padding=4:color=0x400000[g];[1]scale=${half}:-2[a];[2]scale=${half}:-2[b];` +
      `[a][b]hstack=2,pad=${gridW}:ih+4:0:4:0x400000[c];[g][c]vstack=2`,
    "-frames:v", "1", "-q:v", "3", out]);
  return out;
}

/** Números (no vídeo original) dos quadros usados. `fpsByTime` da cena = [[a partir de (s), fps], ...]: cada trecho
 *  com a sua taxa (a T4 usa 12 fps no começo lento e 24 na explosão). O último quadro sempre entra; nada depois do
 *  corte; sem o 1º quadro quando ele repete o último da cena anterior. */
function sourceFrames(scene, info, last, skipFirst) {
  const ranges = scene.fpsByTime ?? [[0, scene.fps ?? FPS]];
  const used = new Set();
  ranges.forEach(([from, fps], i) => {
    const a = Math.round(from * info.fps);
    const b = i + 1 < ranges.length ? Math.round(ranges[i + 1][0] * info.fps) - 1 : last;
    const step = Math.max(1, Math.round(info.fps / fps));
    for (let n = a; n <= Math.min(b, last); n += step) used.add(n);
  });
  used.add(last);
  if (skipFirst) used.delete(0);
  return [...used].sort((x, y) => x - y);
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
  const last = scene.cutAt ? Math.round(scene.cutAt * info.fps) : info.frames - 1; // índice do último quadro usado
  const skipFirst = prevHadVideo; // o primeiro quadro repete o último da cena anterior
  prevHadVideo = true;
  const used = sourceFrames(scene, info, last, skipFirst);
  const expr = used.map((n) => `eq(n\\,${n})`).join("+");

  // `quality` da cena (scenes.js) vale por cima da padrão: as cenas de pó comprimem mal e escondem bem a compressão
  const versions = {
    desktop: { vf: `scale=${Math.min(1600, info.width)}:-2:flags=lanczos`, q: scene.quality?.desktop ?? Q_DESKTOP },
    mobile: { vf: `crop=ih:ih,scale=${MOBILE_SIZE}:${MOBILE_SIZE}:flags=lanczos`, q: scene.quality?.mobile ?? Q_MOBILE },
  };
  // `frames`: número de cada quadro no vídeo original (o site acha o quadro pelo tempo, mesmo com taxas diferentes)
  const entry = { video: scene.video, sourceFps: info.fps, lastSourceFrame: last, skipFirst, seconds: (last + 1) / info.fps, frames: used };
  // corte por tempo na entrada: só até o fim do último quadro usado (o quadro 90 da T4 vai de 3,75 a 3,79 s)
  const cutInput = scene.cutAt ? ["-t", ((last + 1) / info.fps).toFixed(4)] : [];
  for (const [v, { vf, q }] of Object.entries(versions)) {
    const dir = join(WORK, v, scene.id);
    mkdirSync(dir, { recursive: true });
    run("ffmpeg", ["-v", "error", "-y", ...cutInput, "-i", file, "-an", "-vf", `select='${expr}',${vf}`, "-fps_mode", "passthrough",
      "-c:v", "libwebp", "-quality", String(q), "-compression_level", "6", "-start_number", "1", join(dir, "%03d.webp")]);
    const list = readdirSync(dir).filter((f) => f.endsWith(".webp")).sort().map((f) => join(dir, f));
    const p = probe(list[0]);
    files[v][scene.id] = list;
    entry[v] = { count: list.length, width: p.width, height: p.height };
  }
  manifest.scenes[scene.id] = entry;
  console.log(`${scene.id}: ${entry.desktop.count} quadros (${entry.desktop.width}x${entry.desktop.height}) | celular ${entry.mobile.count}` +
    `${skipFirst ? " | sem o 1º quadro (emenda)" : ""}${scene.cutAt ? ` | cortada em ${scene.cutAt} s (quadro ${last})` : ""}`);
  if (scene.cutAt) console.log(`   prancha para conferir o corte: ${checkSheet(scene, files.desktop[scene.id])}`);
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
