// Inclinação 3D dos cartões de produto ao passar o mouse (só computador), com um reflexo de luz que
// acompanha o cursor. Volta suave ao sair.
const MAX = 8; // graus

export function initTilt({ gsap, selector = ".produto" }) {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduced) return;

  document.querySelectorAll(selector).forEach((card) => {
    const glare = document.createElement("span");
    glare.className = "tilt-glare";
    glare.setAttribute("aria-hidden", "true");
    card.append(glare);
    const rx = gsap.quickTo(card, "rotationX", { duration: 0.6, ease: "power3" });
    const ry = gsap.quickTo(card, "rotationY", { duration: 0.6, ease: "power3" });
    gsap.set(card, { transformPerspective: 900 });

    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width; // 0..1
      const py = (e.clientY - r.top) / r.height;
      ry((px - 0.5) * 2 * MAX);
      rx(-(py - 0.5) * 2 * MAX);
      glare.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
      glare.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
    });
    card.addEventListener("pointerenter", () => card.classList.add("is-tilting"));
    card.addEventListener("pointerleave", () => {
      card.classList.remove("is-tilting");
      rx(0);
      ry(0);
    });
  });
}
