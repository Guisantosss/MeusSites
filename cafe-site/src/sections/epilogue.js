// Epílogo do filme: depois da etapa 05 a câmera mergulha na crema da xícara, o manifesto acende por cima palavra
// por palavra e, no fim, tudo escurece até o preto. O filme solta a página já no preto da seção seguinte, então a
// passagem do filme para o resto do site não tem corte.
// Como o resto do filme, tudo é função do estado da rolagem: rolar para cima desfaz cada detalhe igualzinho.
// Trechos (fração do epílogo): 0 a 0,14 a etapa 05 sai | 0,06 a 0,94 câmera | 0,14 a 0,62 o título acende |
// 0,6 a 0,74 entra o parágrafo | 0,86 a 0,985 preto.
import { FILM } from "../config/scenes.js";
import { clamp, easeInOutCubic, smoothstep } from "../film/math.js";

const UNLIT = 0.2; // palavra ainda apagada

export function createEpilogue(root) {
  const lead = root.querySelector(".epilogue__lead");
  const text = root.querySelector(".epilogue__text");
  const veil = root.querySelector(".epilogue__veil");
  const black = root.querySelector(".epilogue__black");
  // cada palavra do título vira um <span> (spans dentro do título: a leitura de tela lê a frase normalmente)
  lead.innerHTML = lead.textContent
    .trim()
    .split(/\s+/)
    .map((w) => `<span class="epilogue__word">${w}</span>`)
    .join(" ");
  const words = [...lead.querySelectorAll(".epilogue__word")].map((el) => ({ el, v: -1 }));
  let last = -1; // só escreve estilo quando a rolagem muda
  const set = (el, prop, value) => (el.style[prop] = value);

  return {
    /** Câmera do canvas no estado atual (null fora do epílogo). `mode`: "desktop" ou "mobile". */
    camera(state, mode) {
      if (state.kind !== "outro") return null;
      const { focus, zoom } = FILM.epilogue[mode] ?? FILM.epilogue.desktop;
      const c = easeInOutCubic(smoothstep(0.06, 0.94, state.local));
      return { z: 1 + (zoom - 1) * c, fx: focus.x, fy: focus.y, k: c };
    },

    update(state) {
      const l = state.kind === "outro" ? state.local : 0;
      if (l === last) return;
      last = l;
      set(root, "visibility", l > 0 ? "visible" : "hidden");
      if (l <= 0) return;
      set(veil, "opacity", smoothstep(0.08, 0.34, l).toFixed(3));
      set(black, "opacity", smoothstep(0.86, 0.985, l).toFixed(3));

      const show = smoothstep(0.14, 0.26, l);
      set(lead, "opacity", show.toFixed(3));
      set(lead, "transform", `translate3d(0, ${((1 - show) * 28).toFixed(2)}px, 0)`);
      const lit = smoothstep(0.2, 0.62, l) * words.length;
      for (let i = 0; i < words.length; i++) {
        const v = Math.round((UNLIT + (1 - UNLIT) * clamp(lit - i)) * 1000) / 1000;
        if (v !== words[i].v) {
          words[i].el.style.opacity = v;
          words[i].v = v;
        }
      }
      const t = smoothstep(0.6, 0.74, l);
      set(text, "opacity", t.toFixed(3));
      set(text, "transform", `translate3d(0, ${((1 - t) * 16).toFixed(2)}px, 0)`);
    },
  };
}
