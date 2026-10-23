// Menu fixo: aparece quando o filme acaba, some enquanto a pessoa desce e volta quando ela sobe (fica sempre
// visível se o foco do teclado estiver nele). Os links rolam suave pelo Lenis.
export function initTopbar({ ScrollTrigger, lenis }) {
  const bar = document.getElementById("topbar");
  if (!bar) return;
  ScrollTrigger.create({
    trigger: "#origens",
    start: "top 65%",
    end: "max",
    onToggle: (self) => bar.classList.toggle("is-on", self.isActive),
    onUpdate: (self) => bar.classList.toggle("is-away", self.direction > 0),
  });

  bar.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      const to = target.id === "film" ? 0 : target;
      if (lenis) lenis.scrollTo(to, { duration: target.id === "film" ? 2.4 : 1.5 });
      else window.scrollTo({ top: to === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
    });
  });
}
