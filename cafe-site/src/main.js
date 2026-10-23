// As fontes (servidas pelo próprio site, com preload) estão declaradas no <head> do index.html.
import "lenis/dist/lenis.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/film.css";
import "./styles/sections.css";
import "./styles/fx.css";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { SCENES } from "./config/scenes.js";
import { initFilm } from "./film/film.js";
import { initCursor } from "./fx/cursor.js";
import { initMagnetic } from "./fx/magnetic.js";
import { initTilt } from "./fx/tilt.js";
import { markVisible } from "./fx/visibility.js";
import { initCardapio } from "./sections/cardapio.js";
import { initFaixa } from "./sections/faixa.js";
import { initGraos } from "./sections/graos.js";
import { playIntro } from "./sections/intro.js";
import { initOrigens } from "./sections/origens.js";
import { initPreloader } from "./sections/preloader.js";
import { initReveals } from "./sections/reveal.js";
import { initTopbar } from "./sections/topbar.js";
import { initVisite } from "./sections/visite.js";

document.documentElement.classList.remove("no-js");
gsap.registerPlugin(ScrollTrigger, SplitText);
// a barra de endereço do celular aparecendo/sumindo não recalcula as posições (evita pulos no meio do filme)
ScrollTrigger.config({ ignoreMobileResize: true });

// o filme é uma história com começo: ao recarregar, sempre volta para a abertura
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.documentElement.classList.toggle("reduced-motion", reducedMotion);

// Rolagem suave: Lenis no mouse e no trackpad; no toque fica a rolagem nativa do celular (mais fiel no iPhone).
// No toque o Lenis nem é criado: ele não suavizaria nada e ainda dobrava o trabalho do ScrollTrigger a cada
// evento de rolagem (medido no celular com CPU 4x).
// O relógio do GSAP move o Lenis e cada passo do Lenis atualiza o ScrollTrigger, então os dois andam juntos.
const touch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
let lenis = null;
if (!reducedMotion && !touch) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// O filme e o preloader primeiro (é o que aparece na tela); as outras seções entram em tarefas separadas, na
// ordem da página (o ScrollTrigger calcula as posições nessa ordem). Tudo numa tarefa só travava a página por
// ~650 ms no celular (Lighthouse); em pedaços, o navegador respira entre um e outro.
const film = initFilm({ gsap, ScrollTrigger, reducedMotion });
if (reducedMotion) {
  document.getElementById("preloader")?.remove();
} else {
  initPreloader({ gsap, film, lenis, onReveal: () => playIntro({ gsap, SplitText }) });
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
const sections = [
  () => initOrigens({ gsap, ScrollTrigger, reducedMotion }),
  () => initFaixa({ gsap, reducedMotion }),
  () => initCardapio({ gsap, ScrollTrigger, reducedMotion }),
  () => initGraos({ gsap, reducedMotion }),
  () => initVisite({ gsap, reducedMotion }),
  () => initReveals({ SplitText, ScrollTrigger, reducedMotion }),
  () => initTopbar({ ScrollTrigger, lenis }),
  () => markVisible(".graos, .visite"),
  // efeitos de mouse (só computador; cada um confere sozinho se há mouse e se o movimento está liberado)
  () => {
    initCursor({ gsap });
    initTilt({ gsap, selector: ".graos__stage", max: 5 });
    initMagnetic({ gsap });
  },
];
(async () => {
  const tempos = import.meta.env.DEV ? [] : null; // conferência: quanto custa montar cada seção
  for (const init of sections) {
    await nextTask();
    const t0 = performance.now();
    init();
    tempos?.push(Math.round(performance.now() - t0));
  }
  if (tempos) window.__tempos = tempos;
  // as fontes mudam a altura dos textos: um único recálculo de posições quando elas e as seções estiverem prontas
  await document.fonts.ready;
  ScrollTrigger.refresh();
})();

if (import.meta.env.DEV) {
  window.__st = ScrollTrigger; // só para os testes automáticos do modo de desenvolvimento
  window.__film = film;
}
// Conferência no modo de desenvolvimento: cena atual, progresso dentro dela e do filme.
// ?semhud esconde o contador (ele mesmo custa: reescrever um texto a cada quadro força layout)
if (import.meta.env.DEV && !new URLSearchParams(location.search).has("semhud")) {
  const out = document.createElement("div");
  out.className = "dev-scroll";
  document.body.append(out);
  let lastTxt = "";
  gsap.ticker.add(() => {
    const s = film.getState();
    const txt = s
      ? `${s.kind === "scene" ? SCENES[s.sceneIndex].id : s.kind} ${(s.local * 100).toFixed(0)}% · filme ${(s.P * 100).toFixed(1)}% · ${film.stats()}`
      : "movimento reduzido";
    if (txt !== lastTxt) out.textContent = lastTxt = txt;
  });
}

export { gsap, ScrollTrigger, SplitText, lenis, reducedMotion };
