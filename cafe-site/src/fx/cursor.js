// Cursor próprio (só computador com mouse): um ponto que segue na hora e um anel que vem atrás.
// Sobre links e botões o anel cresce. O cursor nativo some só onde o próprio aparece.
export function initCursor({ gsap }) {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduced) return;

  const ring = document.createElement("div");
  const dot = document.createElement("div");
  ring.className = "cursor cursor--ring";
  dot.className = "cursor cursor--dot";
  ring.setAttribute("aria-hidden", "true");
  dot.setAttribute("aria-hidden", "true");
  document.body.append(ring, dot);
  document.documentElement.classList.add("has-cursor");

  const ringX = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" });
  const ringY = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });
  const dotX = gsap.quickSetter(dot, "x", "px");
  const dotY = gsap.quickSetter(dot, "y", "px");
  let shown = false;

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      if (!shown) {
        gsap.set([ring, dot], { x: e.clientX, y: e.clientY });
        gsap.to([ring, dot], { opacity: 1, duration: 0.3 });
        shown = true;
      }
      ringX(e.clientX);
      ringY(e.clientY);
      dotX(e.clientX);
      dotY(e.clientY);
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => {
    gsap.to([ring, dot], { opacity: 0, duration: 0.3 });
    shown = false;
  });

  const interactive = "a, button, [data-cursor]";
  document.addEventListener("pointerover", (e) => {
    if (e.target.closest(interactive)) ring.classList.add("is-hover");
  });
  document.addEventListener("pointerout", (e) => {
    if (e.target.closest(interactive) && !e.relatedTarget?.closest?.(interactive)) ring.classList.remove("is-hover");
  });
  document.addEventListener("pointerdown", () => ring.classList.add("is-down"));
  document.addEventListener("pointerup", () => ring.classList.remove("is-down"));
}
