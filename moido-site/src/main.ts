import "@fontsource/big-shoulders-display/latin-800.css";
import "@fontsource/big-shoulders-display/latin-900.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource/figtree/latin-400.css";
import "@fontsource/figtree/latin-500.css";
import "@fontsource/figtree/latin-600.css";
import "./styles.css";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import Lenis from "lenis";
import { SEQ, IMPACT_AT, LABEL_ANCHORS, HERO_BURGER } from "./config";
import { ImageSequence } from "./sequence";

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;
const isSmall = () => window.matchMedia("(max-width: 767px)").matches;
// rótulos das camadas: dos lados do lanche só em tela deitada; em pé (celular, tablet em pé) um por vez embaixo
const SIDE_LABELS = "(min-aspect-ratio: 121/100)";
const STACK_LABELS = "not all and (min-aspect-ratio: 121/100)";
const sideLabels = () => window.matchMedia(SIDE_LABELS).matches;
// cardápio preso com rolagem lateral só onde a comanda cabe na altura; senão vira carrossel de arrastar
const MENU_PIN = "(min-width: 768px) and (min-height: 561px)";
const MENU_SWIPE = "(max-width: 767px), (max-height: 560px)";
const $ =<T extends Element = HTMLElement>(s: string, el: ParentNode = document) => el.querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => [...el.querySelectorAll(s)] as T[];

document.documentElement.classList.toggle("rm", reduced);

// ---------- sequências ----------
const seqs = {
  f1: new ImageSequence($<HTMLCanvasElement>('canvas[data-seq="f1"]'), SEQ.f1),
  f2: new ImageSequence($<HTMLCanvasElement>('canvas[data-seq="f2"]'), SEQ.f2),
  f3: new ImageSequence($<HTMLCanvasElement>('canvas[data-seq="f3"]'), SEQ.f3),
};
// cada seção usa a cor de fundo medida nos quadros, para a troca imagem → animação não aparecer
$(".stage").style.background = SEQ.f1.bg;
$(".chapa").style.background = SEQ.f2.bg;
$(".drip").style.background = SEQ.f3.bg;
let resizeTimer = 0;
let lastW = window.innerWidth, lastH = window.innerHeight;
window.addEventListener("resize", () => {
  // no celular a barra de endereço some e volta ao rolar: muda só a altura e não deve refazer nada
  const w = window.innerWidth, h = window.innerHeight;
  if (!finePointer && w === lastW && Math.abs(h - lastH) < 160) return;
  lastW = w;
  lastH = h;
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => Object.values(seqs).forEach((s) => s.resize()), 120);
});

// ---------- rolagem suave ----------
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, syncTouch: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

$$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href")!;
    if (id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el as HTMLElement, { duration: 1.6 });
    else el.scrollIntoView();
  }),
);

// ---------- barra de progresso e menu ----------
const nav = $(".nav");
const bar = $(".progress span");
const onScroll = (scroll: number, direction: number, progress: number) => {
  bar.style.transform = `scaleX(${progress})`;
  nav.classList.toggle("is-hidden", direction > 0 && scroll > 240);
};
if (lenis) lenis.on("scroll", (l: Lenis) => onScroll(l.scroll, l.direction, l.progress));
else {
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    onScroll(y, y > lastY ? 1 : -1, max > 0 ? y / max : 0);
    lastY = y;
  }, { passive: true });
}

// ---------- carregamento ----------
async function boot() {
  const loader = $(".loader");
  const countEl = $(".loader__count");
  const unitEl = $(".loader__unit");
  const hero = $<HTMLImageElement>(".hero__burger");
  const FIRST = 24;
  const total = FIRST + 2;
  let done = 0;
  const bump = () => { if (done < total) done++; };

  hero.decode().catch(() => {}).then(bump);
  document.fonts.ready.then(bump);
  seqs.f1.load(FIRST, bump);

  if (reduced) {
    nav.classList.add("is-in");
    loader.remove();
    seqs.f2.load(1);
    seqs.f2.render(1);
    initAll();
    return;
  }

  const t0 = performance.now();
  let shown = 0;
  await new Promise<void>((resolve) => {
    const tick = () => {
      const floor = Math.min(1, (performance.now() - t0) / 1300) * 100;
      const target = Math.min((done / total) * 100, floor);
      shown += (target - shown) * 0.16;
      countEl.textContent = String(Math.round(shown));
      if (shown > 99.4) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });

  const tl = gsap.timeline();
  tl.to(".loader__num", { scale: 0.9, duration: 0.18, ease: "power2.in" })
    .add(() => { countEl.textContent = "250"; unitEl.textContent = "°"; })
    .to(".loader__num", { scale: 1, duration: 0.5, ease: "back.out(3)" })
    .to(".loader__glow", { scale: 1.6, opacity: 1, duration: 0.6, ease: "power2.out" }, "<")
    .to(loader, { yPercent: -100, duration: 1, ease: "power4.inOut" }, "+=0.25")
    .add(() => { loader.remove(); lenis?.start(); }, "-=0.35");
  initAll();
  intro(tl);
}

function intro(after: gsap.core.Timeline) {
  const tl = gsap.timeline({ paused: true });
  tl.from(".hero__line", { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.08 })
    .from(".hero__burger", {
      y: (_i: number, el: Element) => Number(gsap.getProperty(el, "y")) + 40,
      scale: (_i: number, el: Element) => Number(gsap.getProperty(el, "scale")) * 0.94,
      opacity: 0, duration: 1.2, ease: "power3.out",
    }, 0.1)
    .from(".hero__copy > *, .hero__actions > *", { y: 24, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.06 }, 0.4)
    .from(".hero__hint", { opacity: 0, duration: 0.6 }, 0.9)
    .add(() => nav.classList.add("is-in"), 0.3);
  after.add(() => { tl.play(); }, "-=0.55");
}

// ---------- palco: abertura + desmontar ----------
function initStage() {
  const stage = $(".stage");
  const canvas = $('canvas[data-seq="f1"]');
  const burger = $<HTMLImageElement>(".hero__burger");
  const svg = $<SVGSVGElement>(".layers__lines");
  const items = $$<HTMLLIElement>(".layers__list li");
  const NS = "http://www.w3.org/2000/svg";
  const parts = LABEL_ANCHORS.map(() => {
    const g = document.createElementNS(NS, "g");
    const line = document.createElementNS(NS, "path");
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("r", "4");
    g.append(line, dot);
    svg.append(g);
    return { line, dot };
  });

  const title = $(".hero__title");
  const place = () => {
    const { x, y, scale } = seqs.f1.placement;
    const fw = SEQ.f1.width * scale, fh = SEQ.f1.height * scale;
    Object.assign(burger.style, { left: `${x}px`, top: `${y}px`, width: `${fw}px`, height: `${fh}px`, transformOrigin: `50% ${HERO_BURGER.cy * 100}%` });
    // abertura: lanche um pouco menor, centralizado entre as duas linhas do título
    const vh = window.innerHeight, vw = window.innerWidth;
    let heroScale = isSmall() ? 1 : vh < 720 ? 0.62 : 0.7;
    let centerY = vh * 0.47;
    let room = vh * 0.66; // altura para o título + lanche
    if (isSmall()) {
      // celular: título e lanche cabem entre o menu e o texto de baixo (celular baixo, tipo iPhone SE, encolhe o lanche)
      const pin = $(".stage__pin").getBoundingClientRect().top;
      const top = 76, bottom = $(".hero__copy").getBoundingClientRect().top - pin - 14;
      centerY = (top + bottom) / 2;
      room = bottom - top;
      heroScale = Math.min(1, Math.max(0.55, (room - 1.6 * vw * 0.17) / (HERO_BURGER.h * fh * 0.98)));
    }
    const bh = HERO_BURGER.h * fh * heroScale;
    const gap = bh * (isSmall() ? 0.98 : 0.8);
    const font = Math.min(vw * (isSmall() ? 0.24 : 0.21), (room - gap) / 1.6);
    Object.assign(title.style, { fontSize: `${font}px`, gap: `${gap}px`, height: `${centerY * 2}px` });
    if (!stageStarted) gsap.set(burger, { y: centerY - (y + HERO_BURGER.cy * fh), scale: heroScale });
    const L = Math.max(60, Math.min(120, window.innerWidth * 0.07));
    LABEL_ANCHORS.forEach((a, i) => {
      const ax = x + a.x * fw, ay = y + a.y * fh;
      const ex = a.side === "right" ? ax + L : ax - L;
      parts[i].line.setAttribute("d", `M${ax} ${ay} H${ex}`);
      parts[i].dot.setAttribute("cx", String(ax));
      parts[i].dot.setAttribute("cy", String(ay));
      if (sideLabels() && !reduced) { // movimento reduzido: lista simples, sem rótulos dos lados
        // o texto quebra em duas linhas se não couber entre a linha e a borda da tela
        const room = a.side === "right" ? window.innerWidth - (ex + 14) - 16 : ex - 14 - 16;
        Object.assign(items[i].style, {
          left: a.side === "right" ? `${ex + 14}px` : "auto",
          right: a.side === "left" ? `${window.innerWidth - ex + 14}px` : "auto",
          top: `${ay}px`,
          maxWidth: `${Math.max(120, Math.round(room))}px`,
        });
        items[i].dataset.side = a.side;
      } else {
        // só a posição: as propriedades de animação (opacidade, deslocamento) continuam com o GSAP
        Object.assign(items[i].style, { left: "", right: "", top: "", maxWidth: "" });
        delete items[i].dataset.side;
      }
    });
  };
  let stageStarted = false;
  seqs.f1.onResize(place);
  place();

  if (reduced) return;

  const prog = { p: 0 };
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: () => `+=${(isSmall() ? 3.4 : 4.6) * window.innerHeight}`,
      pin: true,
      scrub: 0.6,
      onUpdate: (st) => { stageStarted = st.progress > 0.001; },
    },
  });
  tl.to(".hero__title", { yPercent: -14, opacity: 0, duration: 0.15 }, 0)
    .to(burger, { y: 0, scale: 1, duration: 0.16, ease: "power1.inOut" }, 0)
    .to(".hero__copy, .hero__actions, .hero__hint", { y: -36, opacity: 0, duration: 0.09 }, 0)
    .set(canvas, { opacity: 1 }, 0.16)
    .set(burger, { opacity: 0 }, 0.165)
    .to(prog, { p: 1, duration: 0.52, onUpdate: () => seqs.f1.render(prog.p) }, 0.17)
    .fromTo(".layers__title", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.05 }, 0.68);

  const mm = gsap.matchMedia();
  mm.add(SIDE_LABELS, () => {
    parts.forEach(({ line, dot }, i) => {
      const at = 0.72 + i * 0.035;
      tl.fromTo(dot, { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.01 }, at)
        .fromTo(line, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.025 }, at)
        .fromTo(items[i], { opacity: 0, x: items[i].dataset.side === "left" ? 16 : -16 }, { opacity: 1, x: 0, duration: 0.02 }, at + 0.015);
    });
    tl.to({}, { duration: 0.06 });
  });
  mm.add(STACK_LABELS, () => {
    parts.forEach(({ dot }, i) => {
      const at = 0.72 + i * 0.04;
      tl.fromTo(dot, { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.01 }, at)
        .fromTo(items[i], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.012 }, at);
      if (i < parts.length - 1) tl.to(items[i], { opacity: 0, y: -12, duration: 0.012 }, at + 0.03);
    });
    tl.to({}, { duration: 0.05 });
  });
}

// ---------- a chapa ----------
function initChapa() {
  const deg = $(".chapa__deg");
  ScrollTrigger.create({ trigger: ".chapa", start: "top bottom+=60%", once: true, onEnter: () => seqs.f2.load(8) });
  if (reduced) {
    deg.textContent = "250"; // sem animação, mostra direto a temperatura da chapa
    return;
  }
  gsap.from(".chapa__copy > *", {
    y: 40, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.08,
    scrollTrigger: { trigger: ".chapa", start: "top 55%", toggleActions: "play none none reverse" },
  });
  const p = { p: 0 }, t = { v: 0 };
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: ".chapa", start: "top top", end: () => `+=${(isSmall() ? 1.8 : 2.4) * window.innerHeight}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
  });
  tl.to(p, { p: 1, duration: 0.92, onUpdate: () => seqs.f2.render(p.p) }, 0)
    .to(t, { v: 250, duration: 0.92 * IMPACT_AT, ease: "power1.in", onUpdate: () => { deg.textContent = String(Math.round(t.v)); } }, 0)
    .to(".chapa__pin", { keyframes: [{ x: -4 }, { x: 4 }, { x: -3 }, { x: 2 }, { x: 0 }], duration: 0.03 }, 0.92 * IMPACT_AT)
    .to({}, { duration: 0.08 });
}

// ---------- cardápio ----------
function countUp(el: HTMLElement) {
  const val = el.querySelector<HTMLElement>(".ticket__val")!;
  const end = Number(el.dataset.price);
  const o = { v: 0 };
  gsap.to(o, { v: end, duration: 0.9, ease: "power2.out", onUpdate: () => { val.textContent = String(Math.round(o.v)); } });
}

function initMenu() {
  const track = $(".menu__track");
  const rail = $(".menu__rail");
  const tickets = $$(".ticket");
  if (reduced) return;
  gsap.set(tickets, { transformPerspective: 900 });
  const mm = gsap.matchMedia();
  mm.add(MENU_PIN, () => {
    const distance = () => Math.max(0, rail.scrollWidth - window.innerWidth);
    const move = gsap.to(rail, {
      x: () => -distance(), ease: "none",
      scrollTrigger: { trigger: ".menu", start: "top top", end: () => `+=${distance() * 1.5}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
    });
    tickets.forEach((tk) => {
      ScrollTrigger.create({
        trigger: tk, containerAnimation: move, start: "left 85%", once: true,
        onEnter: () => countUp(tk.querySelector(".ticket__price")!),
      });
    });
  });
  mm.add(MENU_SWIPE, () => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { countUp(e.target.querySelector(".ticket__price")!); io.unobserve(e.target); }
    }), { root: track, threshold: 0.6 });
    tickets.forEach((tk) => io.observe(tk));
    return () => io.disconnect();
  });
  gsap.from(".menu__head > *", {
    y: 40, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.08,
    scrollTrigger: { trigger: ".menu", start: "top 60%", toggleActions: "play none none reverse" },
  });

  if (finePointer) {
    tickets.forEach((tk) => {
      const rx = gsap.quickTo(tk, "rotationX", { duration: 0.5, ease: "power3" });
      const ry = gsap.quickTo(tk, "rotationY", { duration: 0.5, ease: "power3" });
      tk.addEventListener("pointermove", (e) => {
        const r = tk.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 16);
        rx(-(py - 0.5) * 10);
        tk.style.setProperty("--mx", `${px * 100}%`);
        tk.style.setProperty("--my", `${py * 100}%`);
      });
      tk.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });
  }
}

// ---------- cheddar escorrendo ----------
function initDrip() {
  ScrollTrigger.create({ trigger: ".drip", start: "top bottom+=80%", once: true, onEnter: () => seqs.f3.load(8) });
  if (reduced) return;
  const p = { p: 0 };
  gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: ".drip", start: "top top", end: () => `+=${1.6 * window.innerHeight}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
  })
    .to(p, { p: 1, duration: 0.7, onUpdate: () => seqs.f3.render(p.p) }, 0)
    .fromTo(".drip__flood", { clipPath: "circle(0% at 50% 100%)" }, { clipPath: "circle(150% at 50% 100%)", duration: 0.36, ease: "power2.in" }, 0.6);
}

// ---------- pedido e rodapé ----------
function initOrder() {
  // sobre a seção mostarda o menu troca para tinta escura
  ScrollTrigger.create({
    trigger: ".order", start: "top top+=60", end: "bottom top+=60",
    toggleClass: { targets: ".nav", className: "on-light" },
  });
  if (reduced) return;
  // autoSplit: divide de novo quando a fonte termina de carregar (e recria a animação no onSplit)
  SplitText.create(".order__title", {
    type: "words, chars", mask: "chars", autoSplit: true,
    onSplit: (self) => gsap.from(self.chars, {
      yPercent: 110, duration: 0.9, ease: "power4.out", stagger: 0.035,
      scrollTrigger: { trigger: ".order", start: "top 70%", toggleActions: "play none none reverse" },
    }),
  });
  gsap.from(".order__row > *, .order__info > div", {
    y: 30, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.08,
    scrollTrigger: { trigger: ".order__row", start: "top 85%", toggleActions: "play none none reverse" },
  });
  gsap.fromTo(".footer__word", { backgroundSize: "0% 100%" }, {
    backgroundSize: "100% 100%", ease: "none",
    scrollTrigger: { trigger: ".footer", start: "top 90%", end: "bottom bottom", scrub: 0.6 },
  });

  if (finePointer) {
    $$(".magnetic").forEach((el) => {
      const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.3);
        y((e.clientY - (r.top + r.height / 2)) * 0.3);
      });
      el.addEventListener("pointerleave", () => { x(0); y(0); });
    });
  }
}

// ---------- cursor ----------
function initCursor() {
  if (!finePointer || reduced) return;
  const c = $(".cursor");
  c.classList.add("is-on");
  const x = gsap.quickTo(c, "x", { duration: 0.35, ease: "power3" });
  const y = gsap.quickTo(c, "y", { duration: 0.35, ease: "power3" });
  window.addEventListener("pointermove", (e) => { x(e.clientX); y(e.clientY); }, { passive: true });
  document.addEventListener("pointerover", (e) => {
    const hot = (e.target as Element).closest("a, button, .ticket");
    c.classList.toggle("is-big", !!hot);
  });
}

// ---------- brasas 3D (carregadas depois) ----------
function initEmbers() {
  if (reduced) return;
  const start = () =>
    import("./embers").then(({ startEmbers }) => {
      const em = startEmbers($<HTMLCanvasElement>(".embers"), () => lenis?.velocity ?? 0);
      // somem do cardápio até o rodapé; apagadas, param de desenhar (economiza bateria)
      const fade = (v: number) => {
        if (v > 0) em.setActive(true);
        gsap.to($(".embers"), { opacity: v, duration: 0.6, overwrite: true, onComplete: () => { if (v === 0) em.setActive(false); } });
      };
      const st = ScrollTrigger.create({
        trigger: ".menu", start: "top 40%", endTrigger: ".footer", end: "top 70%",
        onToggle: (self) => fade(self.isActive ? 0 : 1),
      });
      if (st.isActive) fade(0); // as brasas carregam depois: se a pessoa já rolou até aqui, já começam apagadas
      return em;
    });
  if ("requestIdleCallback" in window) (window as any).requestIdleCallback(start, { timeout: 2500 });
  else setTimeout(start, 1200);
}

// ---------- memória: só a sequência perto da tela fica decodificada ----------
function initMemory() {
  const byEl = new Map<Element, ImageSequence>();
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => byEl.get(e.target)?.setAwake(e.isIntersecting)),
    { rootMargin: "150% 0px 150% 0px" }, // "perto" = até 1,5 tela acima ou abaixo
  );
  ([[".stage", seqs.f1], [".chapa", seqs.f2], [".drip", seqs.f3]] as const).forEach(([sel, seq]) => {
    const el = $(sel);
    const target = el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el; // o trecho preso inteiro
    byEl.set(target, seq);
    io.observe(target);
  });
}

let initialized = false;
function initAll() {
  if (initialized) return;
  initialized = true;
  initStage();
  initChapa();
  initMenu();
  initDrip();
  initOrder();
  initCursor();
  initEmbers();
  initMemory();
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

boot();
