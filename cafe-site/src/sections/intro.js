// Entrada da abertura: "Crema" sobe letra por letra de dentro de uma máscara, depois a frase e o indicador de
// rolagem. Roda quando a cortina do preloader começa a subir. Até lá o nome fica desenhado normalmente por baixo
// do preloader (assim o navegador já conta a maior coisa da tela logo no início, o LCP do Lighthouse).
// Anima só as letras e os filhos de .hero; a rolagem anima o contêiner .hero (hero.js), então as duas nunca
// disputam o mesmo elemento.
export function playIntro({ gsap, SplitText }) {
  const title = document.querySelector(".hero__title");
  const subtitle = document.querySelector(".hero__subtitle");
  const hint = document.querySelector(".hero__hint");
  if (!title) return;
  const split = SplitText.create(title, { type: "chars", mask: "chars", charsClass: "hero__char" });
  gsap
    .timeline({ defaults: { ease: "expo.out" } })
    .from(split.chars, { yPercent: 115, duration: 1.4, stagger: 0.07, delay: 0.25 })
    .from(subtitle, { opacity: 0, y: 18, duration: 1.1 }, "-=0.9")
    .from(hint, { opacity: 0, duration: 0.8, ease: "power1.out" }, "-=0.5");
}
