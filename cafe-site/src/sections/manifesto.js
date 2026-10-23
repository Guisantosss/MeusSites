// Manifesto: o parágrafo "acende" palavra por palavra conforme a rolagem.
// Apagado a 40% (o plano sugeria 20%): assim o texto grande mantém o contraste mínimo de acessibilidade (3:1)
// mesmo antes de acender, e o efeito continua bem visível.
// aria "none": a divisão em palavras não mexe na leitura de tela (num <p> o aria-label que ela poria é proibido).
export function initManifesto({ gsap, SplitText, reducedMotion }) {
  const text = document.querySelector(".manifesto__text");
  if (!text || reducedMotion) return;
  const split = SplitText.create(text, { type: "words", wordsClass: "manifesto__word", aria: "none", autoSplit: true,
    onSplit: (self) => {
      return gsap.fromTo(
        self.words,
        { opacity: 0.4 },
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
