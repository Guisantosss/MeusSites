// O filme: seção presa (pin) enquanto a rolagem atravessa as 5 cenas.
// O ScrollTrigger só informa o progresso; o desenho acontece no relógio do GSAP, uma vez por quadro e só se mudou.
import { FILM, SCENES } from "../config/scenes.js";
import { DustField } from "../fx/dust.js";
import { createHero } from "../sections/hero.js";
import { createProgress } from "../sections/progress.js";
import { createSteps } from "../sections/steps.js";
import { FilmCanvas } from "./FilmCanvas.js";
import { KeyframeSource } from "./KeyframeSource.js";
import { buildTimeline, stateAt } from "./timeline.js";

const BASE = import.meta.env.BASE_URL;

export function initFilm({ gsap, ScrollTrigger, reducedMotion }) {
  const section = document.getElementById("film");
  if (reducedMotion) return initStatic(section);

  const stage = section.querySelector(".film__stage");
  const canvas = new FilmCanvas(section.querySelector(".film__canvas"));
  const steps = createSteps(section.querySelector(".steps"));
  const progress = createProgress(section.querySelector(".film__progress"));
  const hero = createHero(section.querySelector(".hero"));
  const segs = buildTimeline();
  let dirty = true;
  const source = new KeyframeSource(() => (dirty = true));
  let dust = null;
  let state = stateAt(segs, 0);

  const measure = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    const square = w < FILM.squareBelow || h > w;
    section.dataset.mode = square ? "square" : "wide";
    canvas.setSize(w, h, square);
    stage.style.setProperty("--sq-top", `${canvas.box.y}px`);
    stage.style.setProperty("--sq-bottom", `${canvas.box.y + canvas.box.h}px`);
    if (!dust || dust.square !== square) {
      dust = new DustField(square ? 40 : 110); // celular: menos partículas (medido: era o que pesava na cena 5)
      dust.square = square;
    }
    source.load(square ? "mobile" : "desktop");
    dirty = true;
  };
  new ResizeObserver(measure).observe(stage);
  measure();

  ScrollTrigger.create({
    id: "film",
    trigger: section,
    start: "top top",
    end: () => `+=${(window.innerHeight * FILM.scrollVh) / 100}`,
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      state = stateAt(segs, self.progress);
      dirty = true;
    },
  });

  const dustOverlay = (ctx, box) => {
    const scene = SCENES[state.sceneIndex];
    if (state.kind === "scene" && scene.dust) dust.draw(ctx, box, state.local);
  };

  gsap.ticker.add(() => {
    if (!dirty) return;
    dirty = false;
    if (source.firstReady) {
      canvas.draw(source.layers(state), dustOverlay);
      section.classList.add("is-ready");
    }
    steps.update(state);
    progress.update(state);
    hero.update(state);
  });

  return { getState: () => state };
}

/** Movimento reduzido: sem filme por rolagem. Cada etapa vira uma imagem parada com os mesmos textos. */
function initStatic(section) {
  section.classList.add("film--static");
  const fmt = new Intl.NumberFormat("pt-BR");
  const list = document.createElement("ol");
  list.className = "film-static";
  list.innerHTML = SCENES.map(
    ({ still, alt, step }) => `
    <li class="film-static__item">
      <img src="${BASE}img/keyframes/desktop/${still}.webp" alt="${alt}" width="1920" height="1080" loading="lazy" decoding="async" />
      <div class="film-static__text">
        <p class="film-static__number" aria-hidden="true">${step.number}</p>
        <h2 class="film-static__title">${step.title}</h2>
        <p>${step.text}</p>
        ${step.counter ? `<p class="film-static__counter">${fmt.format(step.counter.to)} ${step.counter.unit}${step.counter.label ? ` ${step.counter.label}` : ""}</p>` : ""}
      </div>
    </li>`,
  ).join("");
  section.querySelector(".film__stage").append(list);
  return { getState: () => null };
}
