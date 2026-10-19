import type { SeqConfig } from "./config";

export interface Placement {
  x: number; // canto superior esquerdo do quadro, em px CSS
  y: number;
  scale: number; // px CSS por px do quadro original
}

type Frame = ImageBitmap | HTMLImageElement;

const isSmall = () => window.matchMedia("(max-width: 767px)").matches;
const canBitmap = "createImageBitmap" in window;
const COARSE = 8; // um a cada 8 quadros fica sempre decodificado (amostra para nunca faltar imagem)

/** Ordem de carregamento do grosso para o fino: 1º quadro, último, depois um a cada 16, 8, 4, 2 e o resto.
 *  Quem rola rápido vê a animação inteira (mais espaçada) logo, e os quadros do meio chegam depois. */
function coarseToFine(n: number) {
  const seen = new Uint8Array(n);
  const order: number[] = [];
  const add = (i: number) => { if (!seen[i]) { seen[i] = 1; order.push(i); } };
  add(0);
  add(n - 1);
  for (const s of [16, 8, 4, 2, 1]) for (let i = 0; i < n; i += s) add(i);
  return order;
}

/** Espera uma folga do navegador entre um lote e outro. */
const idle = () =>
  new Promise<void>((r) => ("requestIdleCallback" in window ? (window as any).requestIdleCallback(() => r(), { timeout: 300 }) : setTimeout(r, 30)));

/**
 * Sequência de imagens desenhada num canvas e controlada pelo scroll.
 * - No celular usa a pasta <dir>-m: metade dos quadros e, nos clipes "cover", só o miolo da imagem.
 * - Memória: todos os quadros ficam baixados (comprimidos), mas só ficam decodificados a amostra (1 a cada 8),
 *   o último e os vizinhos do quadro atual. Longe da tela (setAwake(false)) a sequência solta tudo.
 *   Decodificar todos de uma vez passava de 1,5 GB no desktop.
 * - A decodificação (createImageBitmap) roda fora da linha principal: carregar não engasga a rolagem.
 * - Se o quadro pedido ainda não está pronto, mostra o mais próximo que está.
 * - Quando o quadro não cobre a tela, as bordas dele somem num degradê da cor de fundo.
 */
export class ImageSequence {
  readonly cfg: SeqConfig;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mobile = false;
  private gen = 0;
  private blobs: (Blob | null)[] = [];
  private frames: (Frame | null)[] = [];
  private decoding = new Set<number>();
  private queue: number[] = [];
  private radius = 20; // vizinhos decodificados de cada lado do quadro atual
  private awake = true;
  private current = -1;
  private wanted = 0;
  private started = false;
  private first = 1;
  placement: Placement = { x: 0, y: 0, scale: 1 };
  private listeners: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, cfg: SeqConfig) {
    this.canvas = canvas;
    this.cfg = cfg;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.mobile = this.wantsMobile();
    this.reset();
    this.resize();
  }

  get length() {
    return this.frames.length;
  }

  /** Quantos quadros estão decodificados agora (para os testes de memória). */
  get decoded() {
    return this.frames.reduce((n, f) => n + (f ? 1 : 0), 0);
  }

  /** O conjunto do celular só serve se o miolo guardado cobre tudo o que aparece na tela. */
  private wantsMobile() {
    if (!isSmall()) return false;
    const { width: fw, height: fh, fit, mobileCrop } = this.cfg;
    if (fit !== "cover" || mobileCrop >= 1) return true;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const scale = Math.max(w / fw, h / fh);
    return w / scale / fw <= mobileCrop;
  }

  private reset() {
    this.frames.forEach((f) => f && "close" in f && f.close());
    const n = this.mobile ? Math.ceil(this.cfg.count / 2) : this.cfg.count;
    this.gen++;
    this.blobs = new Array(n).fill(null);
    this.frames = new Array(n).fill(null);
    this.decoding.clear();
    this.queue = [];
    this.radius = 20; // no celular são metade dos quadros e menores: a faixa cobre mais da animação
    this.current = -1;
  }

  url(i: number) {
    const dir = this.mobile ? `${this.cfg.dir}-m` : this.cfg.dir;
    return `${dir}/${String(i + 1).padStart(4, "0")}.webp`;
  }

  /** Fica decodificado: a amostra, o último quadro e os vizinhos do atual (só com a sequência perto da tela). */
  private keep(i: number) {
    if (!canBitmap) return true; // navegador antigo: imagens comuns, o próprio navegador cuida da memória
    return this.awake && (i % COARSE === 0 || i === this.frames.length - 1 || Math.abs(i - this.wanted) <= this.radius);
  }

  /** Baixa os primeiros `first` quadros (na ordem do grosso para o fino) e devolve uma promessa; o resto segue em segundo plano. */
  load(first = 1, onProgress?: (done: number, total: number) => void): Promise<void> {
    if (this.started) return Promise.resolve();
    this.started = true;
    this.first = first;
    const gen = this.gen;
    const total = this.frames.length;
    const order = coarseToFine(total);
    let done = 0;
    const one = async (i: number) => {
      try {
        if (canBitmap) {
          const res = await fetch(this.url(i));
          if (!res.ok) throw new Error(`${res.status} ${this.url(i)}`);
          const blob = await res.blob();
          if (gen !== this.gen) return; // trocou de conjunto (celular <-> desktop) no meio do caminho
          this.blobs[i] = blob;
          if (this.keep(i)) await this.decode(i);
        } else {
          const img = new Image();
          img.decoding = "async";
          img.src = this.url(i);
          await img.decode();
          if (gen !== this.gen) return;
          this.frames[i] = img;
          this.arrived(i);
        }
      } catch {
        /* quadro faltando: o vizinho cobre */
      }
      if (gen !== this.gen) return;
      done++;
      onProgress?.(done, total);
    };
    const head = order.slice(0, first);
    const tail = order.slice(first);
    const firstBatch = Promise.all(head.map(one));
    firstBatch.then(async () => {
      // baixa o resto em lotes pequenos, com folga entre eles, para não travar a rolagem
      for (let k = 0; k < tail.length && gen === this.gen; k += 4) {
        await Promise.all(tail.slice(k, k + 4).map(one));
        await idle();
      }
    });
    return firstBatch.then(() => undefined);
  }

  private async decode(i: number) {
    const blob = this.blobs[i];
    if (!blob || this.frames[i] || this.decoding.has(i)) return;
    const gen = this.gen;
    this.decoding.add(i);
    try {
      const bmp = await createImageBitmap(blob);
      if (gen !== this.gen || !this.keep(i)) {
        bmp.close(); // a pessoa já rolou para longe deste quadro
        return;
      }
      this.frames[i] = bmp;
      this.arrived(i);
    } catch {
      /* quadro com defeito: o vizinho cobre */
    } finally {
      if (gen === this.gen) this.decoding.delete(i);
    }
  }

  /** Um quadro ficou pronto: redesenha se ele estiver mais perto do pedido do que o que está na tela. */
  private arrived(i: number) {
    if (this.current < 0 || Math.abs(i - this.wanted) < Math.abs(this.current - this.wanted)) this.draw(this.wanted, true);
  }

  /** Solta os quadros que saíram da faixa e decodifica os que entraram (do mais perto para o mais longe). */
  private refill() {
    if (!canBitmap) return;
    const n = this.frames.length;
    for (let i = 0; i < n; i++) {
      const f = this.frames[i];
      if (f && !this.keep(i)) {
        (f as ImageBitmap).close();
        this.frames[i] = null;
      }
    }
    if (!this.awake) {
      this.queue = [];
      return;
    }
    const todo: number[] = [];
    const want = (i: number) => {
      if (i >= 0 && i < n && this.blobs[i] && !this.frames[i] && !this.decoding.has(i) && !todo.includes(i)) todo.push(i);
    };
    for (let d = 0; d <= this.radius; d++) {
      want(this.wanted + d);
      want(this.wanted - d);
    }
    for (let i = 0; i < n; i += COARSE) want(i);
    want(n - 1);
    this.queue = todo;
    this.pump();
  }

  private pump() {
    while (this.decoding.size < 3 && this.queue.length) {
      const i = this.queue.shift()!;
      if (this.keep(i)) this.decode(i).then(() => this.pump());
    }
  }

  /** Perto da tela: decodifica de novo a partir dos arquivos já baixados. Longe: solta a memória. */
  setAwake(v: boolean) {
    if (v === this.awake) return;
    this.awake = v;
    this.refill();
  }

  onResize(fn: () => void) {
    this.listeners.push(fn);
  }

  resize() {
    const mobile = this.wantsMobile();
    if (mobile !== this.mobile) {
      const p = this.frames.length > 1 ? this.wanted / (this.frames.length - 1) : 0;
      this.mobile = mobile;
      this.reset();
      this.wanted = Math.round(p * (this.frames.length - 1));
      if (this.started) {
        this.started = false;
        this.load(this.first);
      }
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingQuality = "high";
    const { width: fw, height: fh, fit, subject } = this.cfg;
    let scale: number;
    if (fit === "cover") {
      scale = Math.max(w / fw, h / fh);
    } else {
      const s = subject ?? { w: 1, h: 1 };
      scale = Math.min(w / (s.w * fw), h / (s.h * fh)) * 0.92;
      scale = Math.min(scale, Math.max(w / fw, h / fh)); // nunca maior que o "cover"
    }
    this.placement = { x: (w - fw * scale) / 2, y: (h - fh * scale) / 2, scale };
    const keep = this.current;
    this.current = -1;
    this.draw(keep < 0 ? this.wanted : keep, true);
    this.listeners.forEach((fn) => fn());
  }

  /** p de 0 a 1 */
  render(p: number) {
    const i = Math.round(Math.max(0, Math.min(1, p)) * (this.frames.length - 1));
    if (i !== this.wanted) {
      this.wanted = i;
      this.refill();
    }
    this.draw(i);
  }

  private nearest(i: number) {
    if (this.frames[i]) return i;
    for (let d = 1; d < this.frames.length; d++) {
      if (i - d >= 0 && this.frames[i - d]) return i - d;
      if (i + d < this.frames.length && this.frames[i + d]) return i + d;
    }
    return -1;
  }

  private draw(i: number, force = false) {
    const k = this.nearest(i);
    if (k < 0 || (k === this.current && !force)) return;
    const img = this.frames[k]!;
    const ctx = this.ctx;
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    ctx.fillStyle = this.cfg.bg;
    ctx.fillRect(0, 0, cw, ch);
    const { x, y, scale } = this.placement;
    const crop = this.mobile ? this.cfg.mobileCrop : 1;
    const fw = this.cfg.width * scale, fh = this.cfg.height * scale;
    const dx = x + (fw * (1 - crop)) / 2, dw = fw * crop;
    ctx.drawImage(img, dx, y, dw, fh);
    this.fadeEdges(dx, y, dw, fh, cw, ch);
    this.current = k;
  }

  /** Bordas do quadro que caem dentro da tela viram um degradê da cor de fundo (nada de linha reta cortando o lanche). */
  private fadeEdges(x: number, y: number, w: number, h: number, cw: number, ch: number) {
    const ctx = this.ctx;
    const solid = this.cfg.bg;
    const clear = solid + "00";
    const len = (size: number) => Math.min(80, size * 0.09);
    const band = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, solid);
      g.addColorStop(1, clear);
      ctx.fillStyle = g;
      ctx.fillRect(rx, ry, rw, rh);
    };
    if (y > 0.5) { const l = len(h); band(0, y, 0, y + l, x, y, w, l); }
    if (y + h < ch - 0.5) { const l = len(h); band(0, y + h, 0, y + h - l, x, y + h - l, w, l); }
    if (x > 0.5) { const l = len(w); band(x, 0, x + l, 0, x, y, l, h); }
    if (x + w < cw - 0.5) { const l = len(w); band(x + w, 0, x + w - l, 0, x + w - l, y, l, h); }
  }
}
