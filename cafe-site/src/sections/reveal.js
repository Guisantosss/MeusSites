// Entradas discretas das seções (o filme é a estrela): títulos sobem por linha de dentro de uma máscara,
// textos de apoio e cartões aparecem uma vez ao entrar na tela.
export function initReveals({ gsap, SplitText, ScrollTrigger, reducedMotion }) {
  if (reducedMotion) return;

  document.querySelectorAll(".section-title, .cta__title").forEach((el) => {
    SplitText.create(el, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 105,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        }),
    });
  });

  gsap.utils.toArray(".section-lead, .cta .btn, .cta__info").forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 16,
      duration: 1,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  ScrollTrigger.batch(".produto", {
    start: "top 88%",
    once: true,
    onEnter: (cards) => gsap.from(cards, { opacity: 0, y: 40, duration: 1.1, ease: "expo.out", stagger: 0.09 }),
  });
}
