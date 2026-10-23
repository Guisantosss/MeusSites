// Barra fina com as 5 etapas embaixo do filme. O comprimento de cada trecho é o peso da cena.
import { SCENES } from "../config/scenes.js";
import { smoothstep } from "../film/math.js";

export function createProgress(root) {
  root.innerHTML = SCENES.map(
    (s) => `<div class="seg" style="--w:${s.weight}">
      <span class="seg__label">${s.step.title}</span>
      <span class="seg__track"><span class="seg__fill"></span></span>
    </div>`,
  ).join("");
  const segs = [...root.querySelectorAll(".seg")].map((el) => ({ el, fill: el.querySelector(".seg__fill"), active: null, v: -1 }));

  return {
    /** Ajusta o comprimento dos trechos quando os pesos mudam (ex.: cena sem vídeo ocupa menos rolagem). */
    setWeights(weights) {
      segs.forEach((s, i) => s.el.style.setProperty("--w", weights[i]));
    },
    update(state) {
      let o = 1;
      if (state.kind === "intro") o = smoothstep(0.55, 1, state.local);
      else if (state.kind === "outro") o = 1 - smoothstep(0.04, 0.14, state.local); // sai junto com a etapa 05
      root.style.opacity = o.toFixed(3);
      segs.forEach((s, i) => {
        let v = 0;
        if (state.kind === "outro" || i < state.sceneIndex) v = 1;
        else if (state.kind === "scene" && i === state.sceneIndex) v = state.local;
        if (Math.abs(v - s.v) > 0.0005) {
          s.fill.style.transform = `scaleX(${v.toFixed(4)})`;
          s.v = v;
        }
        const active = state.kind !== "intro" && i === state.sceneIndex;
        if (active !== s.active) {
          s.el.classList.toggle("is-active", active);
          s.active = active;
        }
      });
    },
  };
}
