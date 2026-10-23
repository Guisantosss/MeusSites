// Marca .is-visible nas seções que têm animação infinita enquanto elas estão na tela; fora dela o CSS pausa a
// animação (animação rodando fora da tela ainda custa trabalho a cada quadro).
export function markVisible(selector) {
  const els = document.querySelectorAll(selector);
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle("is-visible", e.isIntersecting);
  });
  els.forEach((el) => io.observe(el));
}
