// Botões magnéticos: perto do cursor, o botão é puxado um pouco na direção dele (e o texto, um pouco mais).
// Ao sair, volta suave para o lugar. Só computador com mouse.
const MAX_SHIFT = 14; // px: puxão sutil (sem limite, perto da borda o botão andava 40 px e parecia defeito)

export function initMagnetic({ gsap, selector = ".btn--magnetic", strength = 0.3, radius = 90 }) {
  const clampShift = gsap.utils.clamp(-MAX_SHIFT, MAX_SHIFT);
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduced) return;

  document.querySelectorAll(selector).forEach((btn) => {
    const label = btn.querySelector("span") ?? btn;
    const bx = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3" });
    const by = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3" });
    const lx = gsap.quickTo(label, "x", { duration: 0.5, ease: "power3" });
    const ly = gsap.quickTo(label, "y", { duration: 0.5, ease: "power3" });
    let active = false;

    window.addEventListener(
      "pointermove",
      (e) => {
        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const near = Math.abs(dx) < r.width / 2 + radius && Math.abs(dy) < r.height / 2 + radius;
        if (near) {
          active = true;
          const sx = clampShift(dx * strength);
          const sy = clampShift(dy * strength);
          bx(sx);
          by(sy);
          lx(sx * 0.4);
          ly(sy * 0.4);
        } else if (active) {
          active = false;
          bx(0);
          by(0);
          lx(0);
          ly(0);
        }
      },
      { passive: true },
    );
  });
}
