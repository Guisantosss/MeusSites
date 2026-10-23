// Cardápio: no computador, a foto do item segue o cursor (com um leve balanço na direção do movimento), troca com
// uma cortina de baixo para cima e os outros itens apagam. No toque (ou com movimento reduzido) cada item mostra a
// sua miniatura, só com CSS: a classe .has-preview é que esconde as miniaturas.
export function initCardapio({ gsap, ScrollTrigger, reducedMotion }) {
  const section = document.getElementById("cardapio");
  if (!section) return;
  const preview = section.querySelector(".menu__preview");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!fine || reducedMotion || !preview) {
    preview?.remove();
    return;
  }
  section.classList.add("has-preview");
  const list = section.querySelector(".menu");
  const items = [...section.querySelectorAll(".menu__item")];
  const frame = preview.querySelector(".menu__frame");
  const shots = new Map([...preview.querySelectorAll(".menu__shot")].map((img) => [img.dataset.shot, img]));

  // a prévia fica fixa na tela (o "lazy" do navegador carregaria tudo de cara): as fotos entram quando a seção chega perto
  ScrollTrigger.create({
    trigger: section,
    start: "top bottom+=60%",
    once: true,
    onEnter: () => shots.forEach((img) => (img.src = img.dataset.src)),
  });

  // a foto fica um pouco à direita do cursor: o nome do item (à esquerda) continua legível
  gsap.set(frame, { xPercent: -22, yPercent: -50, autoAlpha: 0, scale: 0.85 });
  const px = gsap.quickTo(preview, "x", { duration: 0.7, ease: "power3" });
  const py = gsap.quickTo(preview, "y", { duration: 0.7, ease: "power3" });
  const rot = gsap.quickTo(frame, "rotation", { duration: 0.9, ease: "power3" });
  let lastX = 0;
  let settle = 0;
  let active = null;
  let visible = false;
  let z = 1;

  list.addEventListener("pointermove", (e) => {
    px(e.clientX);
    py(e.clientY);
    rot(gsap.utils.clamp(-7, 7, (e.clientX - lastX) * 0.45));
    lastX = e.clientX;
    clearTimeout(settle);
    settle = setTimeout(() => rot(0), 90); // parou de mexer: a foto volta a ficar reta
  });

  function show(item, e) {
    items.forEach((it) => it.classList.toggle("is-active", it === item));
    list.classList.add("is-hovering");
    const img = shots.get(item.dataset.shot);
    if (img && img !== active) {
      img.style.zIndex = ++z; // a nova foto entra por cima da anterior
      gsap.fromTo(
        img,
        { clipPath: "inset(100% 0% 0% 0%)", scale: 1.18 },
        { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 0.8, ease: "expo.out", overwrite: true },
      );
      active = img;
    }
    if (!visible) {
      visible = true;
      gsap.set(preview, { x: e.clientX, y: e.clientY }); // aparece já embaixo do cursor, sem atravessar a tela
      px(e.clientX);
      py(e.clientY);
      lastX = e.clientX;
      gsap.to(frame, { autoAlpha: 1, scale: 1, duration: 0.6, ease: "expo.out", overwrite: "auto" });
    }
  }

  function hide() {
    if (!visible) return;
    visible = false;
    list.classList.remove("is-hovering");
    items.forEach((it) => it.classList.remove("is-active"));
    gsap.to(frame, { autoAlpha: 0, scale: 0.85, duration: 0.45, ease: "power2.out", overwrite: "auto" });
  }

  items.forEach((item) => item.addEventListener("pointerenter", (e) => show(item, e)));
  list.addEventListener("pointerleave", hide);
  // rolou para longe com o cursor parado em cima: some também
  ScrollTrigger.create({ trigger: list, start: "top bottom", end: "bottom top", onLeave: hide, onLeaveBack: hide });
}
