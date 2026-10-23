// Divide o progresso da rolagem do filme (0 a 1) entre a abertura, as cenas (pelos pesos) e o fim parado.
import { FILM, SCENES } from "../config/scenes.js";
import { clamp } from "./math.js";

/** Peso de cada cena; `hasVideo(id)` diz se a cena já tem quadros reais (sem vídeo vale `weightNoVideo`). */
export function sceneWeight(scene, hasVideo) {
  return !hasVideo(scene.id) && scene.weightNoVideo ? scene.weightNoVideo : scene.weight;
}

export function buildTimeline(hasVideo = () => true) {
  const segs = [
    { kind: "intro", weight: FILM.intro },
    ...SCENES.map((scene, index) => ({ kind: "scene", index, scene, weight: sceneWeight(scene, hasVideo) })),
    { kind: "outro", weight: FILM.outro },
  ];
  const total = segs.reduce((sum, s) => sum + s.weight, 0);
  let acc = 0;
  for (const s of segs) {
    s.start = acc / total;
    acc += s.weight;
    s.end = acc / total;
  }
  return segs;
}

/**
 * Estado do filme num ponto da rolagem. Tudo o que aparece na tela é calculado só a partir dele,
 * por isso rolar para cima desfaz cada detalhe exatamente.
 *   kind: "intro" | "scene" | "outro"; sceneIndex: cena atual (0 a 4); local: progresso dentro do trecho (0 a 1)
 */
export function stateAt(segs, progress) {
  const P = clamp(progress);
  const seg = segs.find((s) => P <= s.end) ?? segs[segs.length - 1];
  const local = clamp((P - seg.start) / (seg.end - seg.start || 1));
  const last = SCENES.length - 1;
  const sceneIndex = seg.kind === "intro" ? 0 : seg.kind === "outro" ? last : seg.index;
  return { P, kind: seg.kind, sceneIndex, local };
}
