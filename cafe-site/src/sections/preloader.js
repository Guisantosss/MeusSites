// Preloader: porcentagem de 0 a 100 que acompanha o carregamento real do essencial do filme
// (1º quadro de cada cena + a T1 inteira). Nunca volta para trás e nunca "termina" antes do filme estar pronto.
// Sai com uma cortina para cima e libera a rolagem.

const MIN_MS = 900; // mesmo com cache, fica o suficiente para ser lido
const MAX_MS = 15000; // rede muito lenta: sai assim mesmo (o filme mostra o quadro pronto mais próximo)

export function initPreloader({ gsap, film, lenis }) {
  const el = document.getElementById("preloader");
  if (!el || !film.loading) {
    el?.remove();
    return Promise.resolve();
  }
  const num = el.querySelector(".preloader__num");
  const bar = el.querySelector(".preloader__bar span");
  document.documentElement.classList.add("is-loading");
  lenis?.stop();

  const t0 = performance.now();
  let shown = 0;
  let ready = false;
  film.loading.ready.then(() => (ready = true));

  return new Promise((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - t0;
      const target = ready || elapsed > MAX_MS ? 1 : film.loading.progress * 0.98;
      // aproxima do alvo suavemente, com um mínimo por quadro para o número nunca parecer travado
      shown = Math.min(target, shown + Math.max((target - shown) * 0.08, target > shown ? 0.004 : 0));
      num.textContent = String(Math.floor(shown * 100));
      bar.style.transform = `scaleX(${shown.toFixed(4)})`;
      if (shown >= 0.999 && elapsed >= MIN_MS) {
        gsap.ticker.remove(tick);
        num.textContent = "100";
        exit();
      }
    };
    const exit = () => {
      gsap
        .timeline({
          onComplete: () => {
            el.remove();
            document.documentElement.classList.remove("is-loading");
            lenis?.start();
            resolve();
          },
        })
        .to(el.querySelectorAll(".preloader__brand, .preloader__count, .preloader__bar"), {
          opacity: 0,
          y: -20,
          duration: 0.5,
          ease: "power2.in",
          stagger: 0.05,
        })
        .to(el, { clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "power3.inOut" }, "-=0.15");
    };
    gsap.ticker.add(tick);
  });
}
