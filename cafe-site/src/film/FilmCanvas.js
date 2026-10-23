// Desenha o filme no canvas.
// Notebook: o canvas cobre a tela; imagem em "cover" com o objeto a 40% da largura, para os textos à direita.
// Celular (ou tela em pé): o canvas tem só o tamanho do quadro quadrado (menos da metade dos pixels de uma tela
// cheia) e as bordas dissolvem no preto por uma máscara de CSS, aplicada pela placa de vídeo sem repintar nada.

const FOCUS_SHIFT = 0.1; // telas largas: o centro da imagem vai para 40% da largura (a borda direita do vídeo é preta)

export class FilmCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.dpr = 1;
    this.square = false;
    this.stageW = 0;
    this.stageH = 0;
    this.box = { x: 0, y: 0, w: 0, h: 0 }; // onde o canvas fica no palco (px de CSS)
  }

  setSize(w, h, square) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.stageW = w;
    this.stageH = h;
    this.square = square;
    if (square) {
      const s = Math.round(Math.min(w, h * 0.58));
      this.box = { x: Math.round((w - s) / 2), y: Math.round(Math.max(48, (h - s) * 0.3)), w: s, h: s };
    } else {
      this.box = { x: 0, y: 0, w, h };
    }
    const { x, y, w: bw, h: bh } = this.box;
    Object.assign(this.canvas.style, { left: `${x}px`, top: `${y}px`, width: `${bw}px`, height: `${bh}px` });
    this.canvas.dataset.edges = square ? (x > 1 ? "all" : "vertical") : "none";
    this.canvas.width = Math.round(bw * this.dpr);
    this.canvas.height = Math.round(bh * this.dpr);
    // mudar o tamanho do canvas zera o estado do contexto (e o conteúdo)
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.invalidate();
  }

  /** Onde a imagem fica em escala 1, em coordenadas do canvas: recorte de origem e retângulo de destino. */
  rectFor(img) {
    const iw = img.naturalWidth || img.width; // <img> ou ImageBitmap
    const ih = img.naturalHeight || img.height;
    const { w: bw, h: bh } = this.box;
    if (this.square) {
      const side = Math.min(iw, ih);
      return { sx: (iw - side) / 2, sy: (ih - side) / 2, sw: side, sh: side, x: 0, y: 0, w: bw, h: bh };
    }
    const s = Math.max(bw / iw, bh / ih);
    const dw = iw * s;
    const dh = ih * s;
    const cx = bw * (bw / bh >= 1.2 ? 0.5 - FOCUS_SHIFT : 0.5);
    return { sx: 0, sy: 0, sw: iw, sh: ih, x: cx - dw / 2, y: (bh - dh) / 2, w: dw, h: dh };
  }

  /** `overlay(ctx, area)`: desenho extra por cima (o pó), na área inteira do canvas; devolve se desenhou algo.
   *  Se as camadas são as mesmas do último desenho e não há nada por cima, não redesenha: com os quadros reais
   *  cada quadro do vídeo dura vários pixels de rolagem, e repintar a mesma imagem era trabalho jogado fora. */
  draw(layers, overlay, overlayActive = false) {
    const sig = layers.map((l) => (l.img ? `${this.idOf(l.img)}:${l.alpha.toFixed(3)}:${l.scale.toFixed(4)}` : "-")).join("|");
    if (!overlayActive && !this.lastOverlay && sig === this.lastSig) return;
    this.lastSig = sig;
    this.lastOverlay = overlayActive;
    const { ctx, dpr } = this;
    const { w: bw, h: bh } = this.box;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, bw, bh);
    for (const layer of layers) {
      if (!layer.img || layer.alpha <= 0) continue;
      const r = this.rectFor(layer.img);
      const w = r.w * layer.scale;
      const h = r.h * layer.scale;
      ctx.globalAlpha = Math.min(1, layer.alpha);
      ctx.drawImage(layer.img, r.sx, r.sy, r.sw, r.sh, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
    }
    ctx.globalAlpha = 1;
    if (overlayActive) overlay?.(ctx, { x: 0, y: 0, w: bw, h: bh });
  }

  /** Identificador estável de cada imagem (para saber se a camada mudou). */
  idOf(img) {
    if (!this.ids) this.ids = new WeakMap();
    let id = this.ids.get(img);
    if (!id) {
      id = (this.nextId = (this.nextId ?? 0) + 1);
      this.ids.set(img, id);
    }
    return id;
  }

  /** Força o próximo desenho (mudou o tamanho, chegou imagem nova etc.). */
  invalidate() {
    this.lastSig = null;
  }
}
