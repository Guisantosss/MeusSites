// O filme: seção presa (pin) enquanto a rolagem atravessa as 5 cenas.
// O ScrollTrigger só informa o progresso; o desenho acontece no relógio do GSAP, uma vez por quadro e só se mudou.
import { FILM, SCENES } from "../config/scenes.js";
import { DustField } from "../fx/dust.js";
import { createHero } from "../sections/hero.js";
import { createProgress } from "../sections/progress.js";
import { createSteps } from "../sections/steps.js";
import { FilmCanvas } from "./FilmCanvas.js";
import { FrameSource } from "./FrameSource.js";
import { KeyframeSource } from "./KeyframeSource.js";
import { buildTimeline, sceneWeight, stateAt } from "./timeline.js";

const BASE = import.meta.env.BASE_URL;

export function initFilm({ gsap, ScrollTrigger, reducedMotion }) {
  const section = document.getElementById("film");
  if (reducedMotion) return initStatic(section);

  const stage = section.querySelector(".film__stage");
  const canvas = new FilmCanvas(section.querySelector(".film__canvas"));
  const steps = createSteps(section.querySelector(".steps"));
  const progress = createProgress(section.querySelector(".film__progress"));
  const hero = createHero(section.querySelector(".hero"));
  let segs = buildTimeline();
  // FILM.scrollVh vale para o filme completo; com uma cena mais curta (sem vídeo), a rolagem total encolhe junto,
  // assim cada cena mantém o ritmo
  const totalOf = (list) => list.reduce((sum, s) => sum + s.weight, 0);
  const fullTotal = totalOf(segs);
  let lengthFactor = 1;
  let dirty = true;
  let dust = null;
  let state = stateAt(segs, 0);
  let mode = null;
  const redraw = () => (dirty = true);

  // Fonte das imagens: com public/frames/manifest.json (gerado por `npm run frames`) o filme usa os quadros reais;
  // sem ele, o modo provisório (imagens-chave). A troca é automática.
  let source = null;
  let loadProgress = 0;
  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));
  // no modo de desenvolvimento, ?provisorio força as imagens-chave (para comparar com os quadros reais)
  const forceKeyframes = import.meta.env.DEV && new URLSearchParams(location.search).has("provisorio");
  fetch(`${BASE}frames/manifest.json`)
    .then((r) => (r.ok && !forceKeyframes ? r.json() : null))
    .catch(() => null)
    .then((manifest) => {
      const useFrames = manifest && Object.keys(manifest.scenes ?? {}).length > 0;
      source = useFrames ? new FrameSource(manifest, redraw) : new KeyframeSource(redraw);
      if (useFrames) {
        source.onProgress = (p) => (loadProgress = p);
        // cena sem vídeo (fusão provisória) ocupa menos rolagem: refaz a divisão e a barra de etapas
        segs = buildTimeline((id) => source.hasFrames(id));
        progress.setWeights(SCENES.map((s) => sceneWeight(s, (id) => source.hasFrames(id))));
        lengthFactor = totalOf(segs) / fullTotal;
        ScrollTrigger.refresh();
        state = stateAt(segs, ScrollTrigger.getById("film")?.progress ?? 0);
      }
      if (mode) loadSource();
    });
  const loadSource = () => {
    const done = source.load(mode);
    (source.loader?.ready ?? done ?? Promise.resolve()).then(() => {
      loadProgress = 1;
      resolveReady();
    });
    dirty = true;
  };

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
    const next = square ? "mobile" : "desktop";
    if (next !== mode) {
      mode = next;
      if (source) loadSource();
    }
    dirty = true;
  };
  new ResizeObserver(measure).observe(stage);
  measure();

  ScrollTrigger.create({
    id: "film",
    trigger: section,
    start: "top top",
    end: () => `+=${(window.innerHeight * FILM.scrollVh * lengthFactor) / 100}`,
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      state = stateAt(segs, self.progress);
      dirty = true;
    },
  });

  // pó só na cena que ainda não tem vídeo (quando a T5 chegar, ele desliga sozinho)
  const dustActive = () => {
    const scene = SCENES[state.sceneIndex];
    return state.kind === "scene" && !!scene.dust && !source.hasFrames?.(scene.id);
  };
  const dustOverlay = (ctx, box) => dust.draw(ctx, box, state.local);

  const perf = { n: 0, total: 0, max: 0 }; // tempo do desenho, para a conferência do modo de desenvolvimento
  gsap.ticker.add(() => {
    if (!dirty) return;
    dirty = false;
    const t0 = performance.now();
    if (source?.firstReady) {
      canvas.draw(source.layers(state), dustOverlay, dustActive());
      section.classList.add("is-ready");
    }
    steps.update(state);
    progress.update(state);
    hero.update(state);
    const dt = performance.now() - t0;
    perf.n++;
    perf.total += dt;
    perf.max = Math.max(perf.max, dt);
  });

  return {
    getState: () => state,
    /** Para o preloader (Fase 4): progresso 0..1 do essencial e a promessa de quando o filme pode começar. */
    loading: { get progress() { return loadProgress; }, ready },
    stats: () => (source ? `${source.kind ?? "provisório"}${source.stats ? ` · ${source.stats()}` : ""}` : "carregando"),
    perf,
  };
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
