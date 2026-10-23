// Fonte dos quadros reais (lidos do manifest.json gerado por `npm run frames`).
// Cena com quadros: desenha o quadro do momento. Cena sem vídeo (a T5, por enquanto): fusão provisória que parte
// do último quadro real da cena anterior. Antes de o primeiro quadro chegar, a imagem-chave segura a tela.
import { SCENES } from "../config/scenes.js";
import { FrameLoader } from "./FrameLoader.js";
import { KeyframeSource } from "./KeyframeSource.js";
import { clamp } from "./math.js";

const BASE = import.meta.env.BASE_URL;

/** Mapeia a fração da rolagem da cena para a fração do tempo do vídeo (linear por partes, `timeMap` em scenes.js). */
function videoTime(scene, l) {
  const map = scene.timeMap;
  if (!map) return l;
  for (let i = 1; i < map.length; i++) {
    const [x0, y0] = map[i - 1];
    const [x1, y1] = map[i];
    if (l <= x1) return y0 + ((l - x0) / (x1 - x0 || 1)) * (y1 - y0);
  }
  return 1;
}

export class FrameSource {
  constructor(manifest, onFrame) {
    this.manifest = manifest;
    this.onFrame = onFrame;
    this.mode = null;
    this.loader = null;
    this.has = (id) => !!manifest.scenes[id];
    // imagens-chave só onde fazem falta: a 1ª tela (antes dos quadros) e as cenas sem vídeo
    const names = [SCENES[0].from];
    for (const s of SCENES) if (!this.has(s.id)) names.push(s.from, s.to);
    this.keyframes = new KeyframeSource(onFrame, [...new Set(names)]);
    this.onProgress = null;
  }

  get kind() {
    return "quadros";
  }

  hasFrames(id) {
    return this.has(id);
  }

  load(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.loader?.dispose(); // troca notebook <-> celular: solta os quadros do outro modo
    const scenes = SCENES.filter((s) => this.has(s.id)).map((s) => ({ id: s.id, count: this.manifest.scenes[s.id][mode].count }));
    this.loader = new FrameLoader({
      base: `${BASE}frames/${mode}/`,
      scenes,
      radius: mode === "mobile" ? 14 : 20,
      coarse: mode === "mobile" ? 12 : 8,
      onFrame: this.onFrame,
    });
    this.loader.start((p) => this.onProgress?.(p));
    this.keyframes.load(mode);
  }

  get firstReady() {
    return !!this.loader?.get(0) || this.keyframes.firstReady;
  }

  /** Índice global do quadro no estado (e o da cena), ou -1 se a cena não tem quadros. */
  frameIndex(state) {
    const scene = SCENES[state.sceneIndex];
    if (!this.has(scene.id)) return -1;
    const count = this.manifest.scenes[scene.id][this.mode].count;
    let t;
    if (state.kind === "intro") t = 0;
    else if (state.kind === "outro") t = 1;
    else t = clamp(videoTime(scene, state.local));
    return this.loader.index(scene.id, Math.round(t * (count - 1)));
  }

  layers(state) {
    const scene = SCENES[state.sceneIndex];
    const g = this.frameIndex(state);
    if (g >= 0) {
      this.loader.setCurrent(g);
      const img = this.loader.get(g);
      return img ? [{ img, alpha: 1, scale: 1 }] : this.keyframes.layers(state);
    }
    // cena sem vídeo: fusão a partir do último quadro real da cena anterior (que é a imagem de saída dela)
    const prev = SCENES[state.sceneIndex - 1];
    let fromImg = null;
    if (prev && this.has(prev.id)) {
      const last = this.loader.index(prev.id, this.manifest.scenes[prev.id][this.mode].count - 1);
      this.loader.setCurrent(last);
      fromImg = this.loader.get(last);
    }
    return this.keyframes.layers(state, fromImg);
  }

  /** Para a conferência no modo de desenvolvimento. */
  stats() {
    const l = this.loader;
    if (!l) return "";
    const per = this.mode === "mobile" ? 800 * 800 * 4 : 1600 * 900 * 4;
    const m = l.memoryMB(per);
    return `quadros ${l.fetched}/${l.total} · prontos ${l.decodedCount} · ~${m.agora.toFixed(0)} MB (pico ${m.pico.toFixed(0)})`;
  }
}
