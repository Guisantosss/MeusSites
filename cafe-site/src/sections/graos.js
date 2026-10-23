// Grãos para levar: uma aba por café. A embalagem é desenhada em SVG (pacote fosco com válvula e rótulo da Crema),
// uma cor por café, e a luz de fundo muda para a cor do café escolhido. Teclado: setas, Home e End (padrão ARIA de
// abas, com a escolha acontecendo no foco).
// TODO: trocar por fotos reais dos produtos quando a marca existir.
const BAGS = {
  minas: { accent: "#D08A3E", origin: "Sul de Minas", country: "Brasil" },
  huila: { accent: "#C0583A", origin: "Huila", country: "Colômbia" },
  sidamo: { accent: "#9B7FB4", origin: "Sidamo", country: "Etiópia" },
  casa: { accent: "#8A6A4A", origin: "Da Casa", country: "Blend" },
};

function bagSVG({ accent, origin, country }, id) {
  return `
  <svg viewBox="0 0 240 320" role="presentation" focusable="false">
    <defs>
      <linearGradient id="bag-${id}" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#0b0a09"/>
        <stop offset="0.22" stop-color="#1d1a18"/>
        <stop offset="0.5" stop-color="#151311"/>
        <stop offset="0.82" stop-color="#1c1917"/>
        <stop offset="1" stop-color="#090807"/>
      </linearGradient>
      <linearGradient id="bag-shine-${id}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.08"/>
        <stop offset="0.4" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- corpo do pacote: um pouco mais largo embaixo, fundo arredondado -->
    <path d="M44 22 H196 Q204 22 205 30 L214 292 Q215 306 201 308 H39 Q25 306 26 292 L35 30 Q36 22 44 22 Z" fill="url(#bag-${id})"/>
    <path d="M44 22 H196 Q204 22 205 30 L214 292 Q215 306 201 308 H39 Q25 306 26 292 L35 30 Q36 22 44 22 Z" fill="url(#bag-shine-${id})"/>
    <!-- solda de cima e vincos -->
    <rect x="36" y="22" width="168" height="16" rx="3" fill="#24201d"/>
    <path d="M40 30 H200" stroke="#000" stroke-opacity="0.5" stroke-width="1" stroke-dasharray="2 3"/>
    <path d="M60 44 Q58 170 56 300" stroke="#fff" stroke-opacity="0.04" stroke-width="10" fill="none"/>
    <!-- válvula -->
    <circle cx="120" cy="66" r="9" fill="#100e0d" stroke="#2c2724" stroke-width="2"/>
    <circle cx="120" cy="66" r="3" fill="#2c2724"/>
    <!-- rótulo -->
    <rect x="58" y="104" width="124" height="150" rx="3" fill="#F2EADF"/>
    <rect x="58" y="104" width="124" height="10" rx="3" fill="${accent}"/>
    <text x="120" y="158" text-anchor="middle" font-family="Instrument Serif, serif" font-size="34" fill="#0b0a09">Crema</text>
    <line x1="80" y1="172" x2="160" y2="172" stroke="#0b0a09" stroke-opacity="0.25"/>
    <text x="120" y="196" text-anchor="middle" font-family="Instrument Serif, serif" font-style="italic" font-size="17" fill="#0b0a09">${origin}</text>
    <text x="120" y="216" text-anchor="middle" font-family="Inter Tight Variable, sans-serif" font-size="9.5" letter-spacing="0.6" fill="#0b0a09" fill-opacity="0.62">${country}</text>
    <text x="120" y="242" text-anchor="middle" font-family="Inter Tight Variable, sans-serif" font-size="9" fill="#0b0a09" fill-opacity="0.5">250 g em grãos</text>
  </svg>`;
}

const KEYS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export function initGraos({ gsap, reducedMotion }) {
  const root = document.getElementById("graos");
  if (!root) return;
  const tabs = [...root.querySelectorAll(".graos__tab")];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
  const ghost = root.querySelector(".graos__ghost");
  const holder = root.querySelector(".graos__bags");
  holder.innerHTML = tabs.map((t, i) => `<div class="graos__bag">${bagSVG(BAGS[t.dataset.bag], i)}</div>`).join("");
  const bags = [...holder.children];
  let current = 0;

  const paint = (i) => {
    const bag = BAGS[tabs[i].dataset.bag];
    root.style.setProperty("--accent", bag.accent);
    return bag;
  };
  gsap.set(bags, { autoAlpha: 0 });
  gsap.set(bags[0], { autoAlpha: 1 });
  ghost.textContent = paint(0).origin;

  function select(i, focus = false) {
    if (focus) tabs[i].focus();
    if (i === current) return;
    const prev = current;
    current = i;
    tabs.forEach((t, k) => {
      t.setAttribute("aria-selected", String(k === i));
      t.tabIndex = k === i ? 0 : -1;
    });
    panels.forEach((p, k) => (p.hidden = k !== i));
    const bag = paint(i);
    if (reducedMotion) {
      gsap.set(bags[prev], { autoAlpha: 0 });
      gsap.set(bags[i], { autoAlpha: 1 });
      ghost.textContent = bag.origin;
      return;
    }
    // o pacote anterior sai para um lado girando e o novo chega do outro (no sentido da escolha)
    const dir = i > prev ? 1 : -1;
    gsap.to(bags[prev], { autoAlpha: 0, xPercent: -34 * dir, rotation: -9 * dir, duration: 0.5, ease: "power2.in", overwrite: true });
    gsap.fromTo(
      bags[i],
      { autoAlpha: 0, xPercent: 34 * dir, rotation: 9 * dir },
      { autoAlpha: 1, xPercent: 0, rotation: 0, duration: 1.1, ease: "expo.out", delay: 0.18, overwrite: true },
    );
    gsap.killTweensOf(ghost); // cliques rápidos: o nome de fundo não fica no meio de duas trocas
    gsap
      .timeline()
      .to(ghost, { opacity: 0, y: -24, duration: 0.3, ease: "power2.in" })
      .call(() => (ghost.textContent = bag.origin))
      .fromTo(ghost, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out" });
    const panel = panels[i];
    gsap.from(panel.children, { opacity: 0, y: 14, duration: 0.7, ease: "power2.out", stagger: 0.06, overwrite: true });
    fillBars(gsap, panel);
  }

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(i));
    t.addEventListener("keydown", (e) => {
      let n = null;
      if (KEYS[e.key]) n = (current + KEYS[e.key] + tabs.length) % tabs.length;
      else if (e.key === "Home") n = 0;
      else if (e.key === "End") n = tabs.length - 1;
      if (n === null) return;
      e.preventDefault();
      select(n, true);
    });
  });
}

/** As barras do perfil sensorial enchem da esquerda para a direita. */
export function fillBars(gsap, panel) {
  gsap.fromTo(
    panel.querySelectorAll(".barra__fill"),
    { scaleX: 0 },
    { scaleX: (_, el) => Number(getComputedStyle(el).getPropertyValue("--v")) / 5, duration: 1.1, ease: "expo.out", stagger: 0.08, delay: 0.1 },
  );
}
