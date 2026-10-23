// Desenha o filme no canvas. Notebook: "cover" com o objeto um pouco à esquerda, para os textos à direita.
// Celular (ou tela em pé): o quadro quadrado do centro, com as bordas de cima e de baixo dissolvendo no preto.

const FOCUS_SHIFT = 0.1; // telas largas: o centro da imagem vai para 40% da largura (a borda direita do vídeo é preta)

export class FilmCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.square = false;
    this.box = null; // área do quadro quadrado (modo celular), em px de CSS
  }

  setSize(w, h, square) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.square = square;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    if (square) {
      const s = Math.min(w, h * 0.58);
      this.box = { x: (w - s) / 2, y: Math.max(48, (h - s) * 0.3), w: s, h: s };
    } else {
      this.box = { x: 0, y: 0, w, h };
    }
    // mudar o tamanho do canvas zera o estado do contexto
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  /** Onde a imagem fica em escala 1: retângulo de origem (recorte) e de destino. */
  rectFor(img) {
    const iw = img.naturalWidth || img.width; // <img> ou ImageBitmap
    const ih = img.naturalHeight || img.height;
    if (this.square) {
      const side = Math.min(iw, ih);
      return { sx: (iw - side) / 2, sy: (ih - side) / 2, sw: side, sh: side, ...this.box };
    }
    const s = Math.max(this.w / iw, this.h / ih);
    const dw = iw * s;
    const dh = ih * s;
    const cx = this.w * (this.w / this.h >= 1.2 ? 0.5 - FOCUS_SHIFT : 0.5);
    return { sx: 0, sy: 0, sw: iw, sh: ih, x: cx - dw / 2, y: (this.h - dh) / 2, w: dw, h: dh };
  }

  draw(layers, overlay) {
    const { ctx, dpr, box } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.w, this.h);

    if (this.square) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
    }
    for (const layer of layers) {
      if (!layer.img || layer.alpha <= 0) continue;
      const r = this.rectFor(layer.img);
      const w = r.w * layer.scale;
      const h = r.h * layer.scale;
      ctx.globalAlpha = Math.min(1, layer.alpha);
      ctx.drawImage(layer.img, r.sx, r.sy, r.sw, r.sh, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
    }
    ctx.globalAlpha = 1;
    overlay?.(ctx, box);
    if (this.square) {
      ctx.restore();
      this.fadeEdges();
    }
  }

  /** Celular: dissolve as bordas do quadrado no preto (a nuvem de pó ocupa o quadro todo). Os lados só quando
   *  o quadrado não encosta nas laterais da tela (tablet em pé). */
  fadeEdges() {
    const { ctx, box } = this;
    const f = box.h * 0.14;
    const fade = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(rx, ry, rw, rh);
    };
    fade(0, box.y, 0, box.y + f, box.x, box.y, box.w, f);
    fade(0, box.y + box.h, 0, box.y + box.h - f, box.x, box.y + box.h - f, box.w, f);
    if (box.x > 1) {
      const s = box.w * 0.12;
      fade(box.x, 0, box.x + s, 0, box.x, box.y, s, box.h);
      fade(box.x + box.w, 0, box.x + box.w - s, 0, box.x + box.w - s, box.y, s, box.h);
    }
  }
}
