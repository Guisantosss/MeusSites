// Abertura sobre a K0: some com a rolagem durante o trecho parado do começo do filme.
// A rolagem mexe só no contêiner .hero; a entrada por letras (Fase 4) vai animar as letras de dentro,
// assim as duas animações nunca disputam o mesmo elemento.
import { smoothstep } from "../film/math.js";

export function createHero(root) {
  const hint = root.querySelector(".hero__hint");
  let last = -1;
  return {
    update(state) {
      const h = state.kind === "intro" ? state.local : 1;
      if (h === last) return;
      last = h;
      root.style.opacity = (1 - smoothstep(0.04, 0.82, h)).toFixed(3);
      root.style.transform = `translate3d(0, ${(-h * 5).toFixed(3)}vh, 0)`;
      root.style.visibility = h >= 0.82 ? "hidden" : "visible";
      root.classList.toggle("is-gone", h >= 0.82); // para a animação do indicador de rolagem
      if (hint) hint.style.opacity = (1 - smoothstep(0, 0.3, h)).toFixed(3);
    },
  };
}
