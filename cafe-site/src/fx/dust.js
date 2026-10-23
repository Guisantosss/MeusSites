// Pó de café caindo sobre a fusão da última cena (enquanto o vídeo T5 não existe).
// Cada partícula é uma função do progresso da cena: rolar para cima faz o pó subir de volta, sem sorteio novo.
// Desenho com "estampas" prontas (um disco de borda suave por cor, feito uma vez só): bem mais leve no celular
// do que montar e preencher um círculo novo por partícula a cada quadro.
import { clamp, seeded, smoothstep } from "../film/math.js";

const CORES = ["139,90,52", "176,122,69", "208,138,62", "96,62,38"];
const SPRITE = 32;

function makeSprite(rgb) {
  const c = document.createElement("canvas");
  c.width = c.height = SPRITE;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.45, `rgba(${rgb},0.85)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE, SPRITE);
  return c;
}

export class DustField {
  constructor(count, seed = 7) {
    this.sprites = CORES.map(makeSprite);
    const rnd = seeded(seed);
    this.particles = Array.from({ length: count }, () => {
      const depth = rnd(); // perto da câmera = maior e mais rápido
      return {
        x: rnd(),
        y: -0.25 + rnd() * 0.9,
        fall: 0.35 + depth * 0.75,
        drift: (rnd() - 0.5) * 0.08,
        sway: rnd() * Math.PI * 2,
        r: 0.8 + depth * depth * 3.2,
        a: 0.35 + rnd() * 0.5,
        sprite: Math.floor(rnd() * CORES.length),
        delay: rnd() * 0.25,
      };
    });
  }

  /** Desenha no retângulo `box` (px de CSS), no progresso `l` (0 a 1) da cena. */
  draw(ctx, box, l) {
    const k = smoothstep(0.02, 0.18, l) * (1 - smoothstep(0.62, 0.95, l));
    if (k <= 0) return;
    const scale = (box.w / 1200) * 1.6;
    for (const p of this.particles) {
      const t = clamp((l - p.delay) / (1 - p.delay));
      const y = p.y + p.fall * t;
      if (y < -0.05 || y > 1.05) continue;
      const alpha = p.a * k * smoothstep(-0.05, 0.1, y) * (1 - smoothstep(0.85, 1.05, y));
      if (alpha <= 0.04) continue; // quase invisível: não vale o desenho
      const x = p.x + p.drift * t + Math.sin(p.sway + t * 5) * 0.006;
      const r = Math.max(0.6, p.r * scale);
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.sprites[p.sprite], box.x + x * box.w - r, box.y + y * box.h - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }
}
