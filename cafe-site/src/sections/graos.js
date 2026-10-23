// Grãos para levar: uma aba por café. Cada café tem a foto do pacote (index.html) e uma cor: a luz de fundo e o nome
// vazado atrás do pacote mudam para a cor do café escolhido. Teclado: setas, Home e End (padrão ARIA de abas, com a
// escolha acontecendo no foco).
const BAGS = {
  minas: { accent: "#D08A3E", origin: "Sul de Minas" },
  huila: { accent: "#C0583A", origin: "Huila" },
  sidamo: { accent: "#9B7FB4", origin: "Sidamo" },
  casa: { accent: "#8A6A4A", origin: "Da Casa" },
};

const KEYS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export function initGraos({ gsap, reducedMotion }) {
  const root = document.getElementById("graos");
  if (!root) return;
  const tabs = [...root.querySelectorAll(".graos__tab")];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
  const ghost = root.querySelector(".graos__ghost");
  // a foto de cada aba (mesma ordem das abas)
  const bags = tabs.map((t) => root.querySelector(`.graos__bag[data-bag="${t.dataset.bag}"]`));
  let current = 0;

  const paint = (i) => {
    const bag = BAGS[tabs[i].dataset.bag];
    root.style.setProperty("--accent", bag.accent);
    return bag;
  };
  // nome vazado atrás do pacote; --len (número de letras) ajusta o tamanho no CSS para o nome longo caber no palco
  const setGhost = (name) => {
    ghost.textContent = name;
    ghost.style.setProperty("--len", name.length);
  };
  gsap.set(bags, { autoAlpha: 0 });
  gsap.set(bags[0], { autoAlpha: 1 });
  setGhost(paint(0).origin);

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
      setGhost(bag.origin);
      return;
    }
    // uma foto esmaece enquanto a outra aparece, no mesmo lugar: o pacote está na mesma posição nas quatro fotos e a
    // silhueta atrás dele (que esconde o nome vazado) fica parada; deslizar ou girar a foto desencontraria os dois
    gsap.to(bags[prev], { autoAlpha: 0, scale: 0.99, duration: 0.5, ease: "power2.out", overwrite: true });
    gsap.fromTo(
      bags[i],
      { autoAlpha: 0, scale: 1.015 },
      { autoAlpha: 1, scale: 1, duration: 0.9, ease: "power2.out", delay: 0.08, overwrite: true },
    );
    gsap.killTweensOf(ghost); // cliques rápidos: o nome de fundo não fica no meio de duas trocas
    gsap
      .timeline()
      .to(ghost, { opacity: 0, y: -24, duration: 0.3, ease: "power2.in" })
      .call(() => setGhost(bag.origin))
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
