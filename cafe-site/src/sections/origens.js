// Origens: a seção fica presa e a rolagem vertical move o trilho na horizontal, como quem sobe a serra. Embaixo,
// a linha do relevo vai acendendo até a altitude de cada origem e o altímetro conta os metros. As fotos andam um
// pouco mais devagar que o cartão (paralaxe), presas ao mesmo movimento (containerAnimation).
// Desempenho: o trecho aceso da linha é revelado só com transformações (uma moldura que anda para um lado e o
// desenho para o outro), sem redesenhar o SVG a cada quadro.
import { seeded } from "../film/math.js";

const fmt = new Intl.NumberFormat("pt-BR");
const TOP = 2400; // altitude do topo da faixa do relevo (m)

/** Curva suave passando pelos pontos (Catmull-Rom convertida em Bézier). */
function smoothPath(pts) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function initOrigens({ gsap, ScrollTrigger, reducedMotion }) {
  const section = document.getElementById("origens");
  if (!section || reducedMotion) return;
  const pin = section.querySelector(".origens__pin");
  const track = section.querySelector(".origens__track");
  const relevo = section.querySelector(".relevo");
  const cards = [...section.querySelectorAll(".origem")];
  const num = section.querySelector(".altimetro__num");

  let dist = 0; // quanto o trilho anda (px)
  let width = 0; // largura do trilho
  let stops = []; // altitude em cada ponto do trilho: [{ x, alt }] (o altímetro começa em 0 m no início da seção)
  let marks = [];
  let lit = null;
  let litInner = null;
  let shownAlt = -1;
  let drawnKey = null; // tamanho com que o relevo foi desenhado (só redesenha se mudar)

  /** Mede o trilho (barato; o fim do movimento depende disso). */
  function measure() {
    width = track.offsetWidth;
    dist = Math.max(0, width - window.innerWidth);
  }

  /** Desenha o relevo a partir das posições reais dos cartões. Fica fora do carregamento (num momento ocioso):
   *  montar o SVG e medir os cartões custava ~100 ms no celular com CPU 4x, em plena abertura do site. */
  function build() {
    const h = relevo.clientHeight;
    drawnKey = `${width}x${h}x${window.innerWidth}`;
    const yOf = (alt) => h - 2 - (alt / TOP) * (h - 26);
    const center = (el) => el.offsetLeft + el.offsetWidth / 2;
    const peaks = cards.map((c) => ({ x: center(c), alt: Number(c.dataset.alt) }));
    // o ponto medido é o meio da tela: na posição inicial ele fica em innerWidth / 2, ainda no nível do mar
    const start = Math.min(window.innerWidth * 0.5, peaks[0].x - 1);
    stops = [{ x: 0, alt: 0 }, { x: start, alt: 0 }, ...peaks, { x: width, alt: peaks.at(-1).alt * 0.9 }];

    // entre um ponto e outro, morros menores (sempre os mesmos: gerador com semente)
    const rand = seeded(11);
    const pts = [];
    stops.forEach((s, i) => {
      pts.push([s.x, yOf(s.alt)]);
      const next = stops[i + 1];
      if (!next) return;
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const base = s.alt + (next.alt - s.alt) * t;
        const dip = Math.sin(t * Math.PI) * (0.12 + rand() * 0.16) * TOP * (k === 2 ? 0.55 : 0.3);
        pts.push([s.x + (next.x - s.x) * (t + (rand() - 0.5) * 0.08), yOf(Math.max(0, base - dip + (rand() - 0.5) * 140))]);
      }
    });
    const line = smoothPath(pts);
    const area = `${line} L${width},${h} L0,${h} Z`;
    const svg = (cls, inner) => `<svg class="${cls}" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">${inner}</svg>`;
    relevo.innerHTML = `
      ${svg("relevo__base", `<path d="${line}" />`)}
      <div class="relevo__lit"><div class="relevo__lit-inner">${svg(
        "relevo__on",
        `<defs><linearGradient id="relevo-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#d08a3e" stop-opacity="0.16"/><stop offset="1" stop-color="#d08a3e" stop-opacity="0"/>
        </linearGradient></defs><path class="relevo__area" d="${area}" /><path d="${line}" />`,
      )}</div></div>
      ${peaks
        .map(
          (p) => `<span class="relevo__marco" style="left:${p.x.toFixed(1)}px;top:${yOf(p.alt).toFixed(1)}px">
            <i></i><span>${fmt.format(p.alt)} m</span></span>`,
        )
        .join("")}`;
    lit = relevo.querySelector(".relevo__lit");
    litInner = relevo.querySelector(".relevo__lit-inner");
    marks = [...relevo.querySelectorAll(".relevo__marco")].map((el, i) => ({ el, x: peaks[i].x, on: false }));
    shownAlt = -1;
  }

  /** Altitude no ponto x do trilho (linear entre os pontos principais). */
  function altAt(x) {
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1];
      const b = stops[i];
      if (x <= b.x) return a.alt + ((x - a.x) / (b.x - a.x || 1)) * (b.alt - a.alt);
    }
    return stops.at(-1)?.alt ?? 0;
  }

  /** Acende o relevo até o meio da tela e atualiza o altímetro. */
  function update(progress) {
    if (!lit) return;
    const x = dist * progress + window.innerWidth * 0.5; // meio da tela, em coordenadas do trilho
    lit.style.transform = `translate3d(${(x - width).toFixed(1)}px, 0, 0)`;
    litInner.style.transform = `translate3d(${(width - x).toFixed(1)}px, 0, 0)`;
    const alt = Math.round(Math.min(altAt(x), stops.at(-2).alt) / 10) * 10;
    if (alt !== shownAlt) {
      num.textContent = fmt.format(alt);
      shownAlt = alt;
    }
    for (const m of marks) {
      const on = x >= m.x - 4;
      if (on !== m.on) {
        m.el.classList.toggle("is-on", on);
        m.on = on;
      }
    }
  }

  measure(); // antes do movimento: o fim dele depende de `dist`
  const move = gsap.fromTo(
    track,
    { x: 0 },
    {
      x: () => -dist,
      ease: "none", // obrigatório: posição horizontal = posição da rolagem
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: () => `+=${dist}`,
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefreshInit: measure, // mede antes de o ScrollTrigger calcular o fim (que depende de `dist`)
        onRefresh: (self) => {
          // tamanho mudou (girou o celular, redimensionou a janela): redesenha o relevo, se ele já existe
          if (drawnKey && drawnKey !== `${width}x${relevo.clientHeight}x${window.innerWidth}`) build();
          update(self.progress);
        },
        onUpdate: (self) => update(self.progress),
      },
    },
  );
  const idle = (fn, o) => (window.requestIdleCallback ? window.requestIdleCallback(fn, o) : setTimeout(fn, 300));
  idle(
    () => {
      build();
      update(move.scrollTrigger.progress);
    },
    { timeout: 2000 },
  );

  cards.forEach((card) => {
    const img = card.querySelector("img");
    gsap.fromTo(
      img,
      { xPercent: -6 },
      {
        xPercent: 6,
        ease: "none",
        scrollTrigger: { trigger: card, containerAnimation: move, start: "left right", end: "right left", scrub: true },
      },
    );
  });
}
