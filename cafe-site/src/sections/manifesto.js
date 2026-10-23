// Manifesto: o parágrafo "acende" palavra por palavra (20% → 100% de opacidade) conforme a rolagem.
export function initManifesto({ gsap, SplitText, reducedMotion }) {
  const text = document.querySelector(".manifesto__text");
  if (!text || reducedMotion) return;
  const split = SplitText.create(text, { type: "words", wordsClass: "manifesto__word", autoSplit: true,
    onSplit: (self) => {
      return gsap.fromTo(
        self.words,
        { opacity: 0.2 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.1,
          scrollTrigger: { trigger: text, start: "top 78%", end: "bottom 42%", scrub: true },
        },
      );
    },
  });
  return split;
}
