// Faixa entre as Origens e o Cardápio: as frases andam para o lado enquanto a página desce (só transformação).
// Onde o navegador sabe prender animação de CSS à rolagem, quem faz é o CSS (sections.css); aqui fica a reserva.
export function initFaixa({ gsap, reducedMotion }) {
  const el = document.querySelector(".faixa");
  if (!el || reducedMotion || CSS.supports("animation-timeline: view()")) return;
  gsap.fromTo(
    el.querySelector(".faixa__track"),
    { xPercent: 0 },
    { xPercent: -22, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } },
  );
}
