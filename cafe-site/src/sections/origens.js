// Origens: a seção fica presa e a rolagem vertical move o trilho na horizontal. As fotos andam um pouco mais
// devagar que o cartão (paralaxe), presas ao mesmo movimento (containerAnimation).
export function initOrigens({ gsap, ScrollTrigger, reducedMotion }) {
  const section = document.getElementById("origens");
  if (!section || reducedMotion) return;
  const pin = section.querySelector(".origens__pin");
  const track = section.querySelector(".origens__track");
  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

  const move = gsap.fromTo(
    track,
    { x: 0 },
    {
      x: () => -distance(),
      ease: "none", // obrigatório: posição horizontal = posição da rolagem
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    },
  );

  section.querySelectorAll(".origem").forEach((card) => {
    const img = card.querySelector("img");
    gsap.fromTo(
      img,
      { xPercent: -6 },
      {
        xPercent: 6,
        ease: "none",
        scrollTrigger: { trigger: card, containerAnimation: move, start: "left right", end: "right left", scrub: true },
      },
    );
  });
}
