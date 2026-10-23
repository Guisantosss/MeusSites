// As 5 etapas do filme, à direita: número que "rola" de uma etapa para a outra, título revelado por máscara,
// frase e contador. Tudo é função do estado da rolagem (nada de animação por tempo aqui).
import { SCENES } from "../config/scenes.js";
import { easeOutCubic, smoothstep } from "../film/math.js";

const fmt = new Intl.NumberFormat("pt-BR");
const LAST = SCENES.length - 1;

export function createSteps(root) {
  root.innerHTML = `
    <p class="steps__number" aria-hidden="true">
      <span class="steps__zero">0</span><span class="steps__digit"><span class="steps__roll">${SCENES.map(
        (s) => `<span>${s.step.number.slice(-1)}</span>`,
      ).join("")}</span></span>
    </p>
    <ol class="steps__list">
      ${SCENES.map(
        ({ step }) => `
        <li class="step">
          <h2 class="step__title"><span class="step__line">${step.title}</span></h2>
          <p class="step__text">${step.text}</p>
          ${
            step.counter
              ? `<p class="step__counter"><span class="step__value"><span class="step__num">${fmt.format(step.counter.from)}</span> ${step.counter.unit}</span>${
                  step.counter.label ? `<span class="step__label">${step.counter.label}</span>` : ""
                }</p>`
              : ""
          }
        </li>`,
      ).join("")}
    </ol>`;

  const number = root.querySelector(".steps__number");
  const roll = root.querySelector(".steps__roll");
  const items = [...root.querySelectorAll(".step")].map((li, i) => ({
    li,
    line: li.querySelector(".step__line"),
    text: li.querySelector(".step__text"),
    counter: li.querySelector(".step__counter"),
    num: li.querySelector(".step__num"),
    data: SCENES[i].step.counter,
    shown: null,
  }));

  /** Entrada (0→1), saída (0→1) e progresso local da etapa i no estado atual. */
  function phase(i, state) {
    if (state.kind === "intro") return { enter: 0, exit: 0, l: 0 };
    if (state.kind === "outro") return i === LAST ? { enter: 1, exit: 0, l: 1 } : { enter: 0, exit: 1, l: 1 };
    if (i !== state.sceneIndex) return { enter: 0, exit: 0, l: 0 };
    const l = state.local;
    return {
      enter: smoothstep(0.03, 0.17, l),
      exit: i === LAST ? 0 : smoothstep(0.83, 0.96, l),
      l,
    };
  }

  return {
    update(state) {
      // no epílogo a etapa 05 sai de cena para o manifesto entrar
      root.style.opacity = state.kind === "outro" ? (1 - smoothstep(0.04, 0.14, state.local)).toFixed(3) : "";
      // número: "0" fixo e o segundo dígito rola para o próximo no fim de cada cena
      let pos = state.sceneIndex;
      if (state.kind === "scene" && state.sceneIndex < LAST) pos += smoothstep(0.86, 0.99, state.local);
      roll.style.transform = `translate3d(0, ${(-pos).toFixed(4)}em, 0)`;
      const first = phase(0, state);
      number.style.opacity = state.kind === "intro" ? 0 : state.sceneIndex === 0 && state.kind === "scene" ? first.enter : 1;

      items.forEach((it, i) => {
        const { enter, exit, l } = phase(i, state);
        const visible = enter > 0 && exit < 1;
        if (visible !== it.shown) {
          it.li.classList.toggle("is-current", visible);
          it.shown = visible;
        }
        if (!visible && it.wasHidden) return; // já escondida: não escreve estilo à toa
        it.wasHidden = !visible;
        const y = (1 - enter) * 105 - exit * 105;
        it.line.style.transform = `translate3d(0, ${y.toFixed(2)}%, 0)`;
        const fade = enter * (1 - exit);
        it.text.style.opacity = (smoothstep(0.35, 1, enter) * (1 - exit)).toFixed(3);
        it.text.style.transform = `translate3d(0, ${((1 - enter) * 14).toFixed(2)}px, 0)`;
        if (it.counter) {
          it.counter.style.opacity = (smoothstep(0.6, 1, enter) * (1 - exit)).toFixed(3);
          const v = it.data.from + (it.data.to - it.data.from) * easeOutCubic(smoothstep(0.1, 0.8, l));
          const txt = fmt.format(Math.round(v));
          if (it.num.textContent !== txt) it.num.textContent = txt;
        }
        it.li.style.opacity = fade > 0 ? 1 : 0;
      });
    },
  };
}
