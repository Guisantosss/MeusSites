// Fontes servidas pelo próprio site (mais rápido que o Google Fonts e melhor no Lighthouse)
import "./styles/fonts.css";
import "lenis/dist/lenis.css";
import "./styles/tokens.css";
import "./styles/base.css";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.documentElement.classList.toggle("reduced-motion", reducedMotion);

// Rolagem suave: Lenis no mouse e no trackpad; no toque fica a rolagem nativa do celular (mais fiel no iPhone).
// O relógio do GSAP move o Lenis e cada passo do Lenis atualiza o ScrollTrigger, então os dois andam juntos.
let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// Conferência da Fase 1: no modo de desenvolvimento, um contador no canto mostra o progresso da página
// lido pelo ScrollTrigger. Se ele acompanha a rolagem sem saltos, Lenis e GSAP estão sincronizados.
if (import.meta.env.DEV) {
  const out = document.createElement("div");
  out.className = "dev-scroll";
  document.body.append(out);
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      out.textContent = `rolagem ${(self.progress * 100).toFixed(1)}% · ${lenis ? "Lenis ligado" : "movimento reduzido"}`;
    },
  });
  out.textContent = `rolagem 0.0% · ${lenis ? "Lenis ligado" : "movimento reduzido"}`;
}

export { gsap, ScrollTrigger, SplitText, lenis, reducedMotion };
