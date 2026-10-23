// Entradas discretas das seções (o filme é a estrela): títulos sobem por linha de dentro de uma máscara, textos de
// apoio aparecem, os itens do cardápio chegam em sequência com a linha se desenhando.
// Aqui só se marca .is-in quando o elemento entra na tela; o movimento é uma transição de CSS (opacidade e posição),
// que o navegador roda na placa de vídeo. Medido no celular com CPU 4x: as mesmas entradas feitas quadro a quadro
// pelo GSAP obrigavam a página inteira a recalcular estilo e camadas a cada quadro, e a rolagem caía a 30 por segundo.
export function initReveals({ SplitText, ScrollTrigger, reducedMotion }) {
  if (reducedMotion) return;

  /** Marca a entrada, com um atraso crescente para quem entrou junto (--d). */
  const enter = (els, step) =>
    els.forEach((el, i) => {
      el.style.setProperty("--d", `${(i * step).toFixed(2)}s`);
      el.classList.add("is-in");
    });

  // dividir os títulos em linhas mede o texto (caro): um título por vez, nos momentos ociosos do navegador, e não
  // tudo junto na abertura do site. Título que chegar à tela antes de ser dividido só aparece, sem a subida.
  const idle = (fn, o) => (window.requestIdleCallback ? window.requestIdleCallback(fn, o) : setTimeout(fn, 200));
  document.querySelectorAll(".section-title").forEach((el) =>
    idle(
      () =>
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          linesClass: "title-line",
          autoSplit: true,
          onSplit: (self) => self.lines.forEach((line, i) => line.style.setProperty("--i", i)),
        }),
      { timeout: 3000 },
    ),
  );

  ScrollTrigger.batch(".section-title, .eyebrow, .section-lead, .visite__status, .visite .btn, .visite__info", {
    start: "top 88%",
    once: true,
    onEnter: (els) => enter(els, 0.06),
  });
  ScrollTrigger.batch(".menu__item", { start: "top 92%", once: true, onEnter: (rows) => enter(rows, 0.08) });
  ScrollTrigger.batch(".graos__body", { start: "top 78%", once: true, onEnter: (els) => enter(els, 0) });
}
