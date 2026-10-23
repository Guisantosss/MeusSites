// Carregamento dos quadros do filme, com memória limitada.
//
// Busca (rede): 1) o 1º quadro de cada cena; 2) a T1 inteira (o preloader espera só por 1 e 2); 3) o resto,
// cena por cena, do grosso para o fino (1 a cada 8, depois 4, 2, 1), para o filme inteiro ficar navegável cedo.
// Memória: todo quadro baixado fica guardado COMPRIMIDO (Blob, ~30 a 40 KB). Decodificado (ImageBitmap, ~5,8 MB
// no notebook e ~2,6 MB no celular) só fica o que está perto do quadro atual, uma amostra (1 a cada N) e as pontas
// das cenas. O resto é liberado. Sem isso, os ~330 quadros decodificados passariam de 1,5 GB e o iPhone fecharia a aba.
// Se o quadro pedido ainda não está pronto, `get()` devolve o pronto mais próximo e pede o exato com prioridade.

const FETCH_CONCURRENCY = 6;
const DECODE_CONCURRENCY = 3;

export class FrameLoader {
  /**
   * @param {object} o
   * @param {string} o.base      pasta dos quadros deste modo (ex.: "./frames/desktop/")
   * @param {{id: string, count: number}[]} o.scenes  cenas com quadros, na ordem do filme
   * @param {number} o.radius    quantos vizinhos do quadro atual ficam decodificados (para cada lado)
   * @param {number} o.coarse    amostra sempre decodificada (1 a cada N): rolagem rápida sempre tem um quadro perto
   * @param {() => void} o.onFrame chamado quando um quadro novo fica pronto para desenhar
   */
  constructor({ base, scenes, radius, coarse = 8, onFrame }) {
    this.base = base;
    this.radius = radius;
    this.coarse = coarse;
    this.onFrame = onFrame;
    this.offsets = {};
    this.urls = [];
    for (const s of scenes) {
      this.offsets[s.id] = this.urls.length;
      for (let i = 1; i <= s.count; i++) this.urls.push(`${base}${s.id}/${String(i).padStart(3, "0")}.webp`);
    }
    this.total = this.urls.length;
    this.blobs = new Array(this.total).fill(null);
    this.bitmaps = new Array(this.total).fill(null);
    this.decoding = new Set();
    this.live = new Set(); // índices com ImageBitmap pronta (para soltar sem varrer todos os quadros)
    this.current = 0;
    this.fetched = 0;
    this.decodedCount = 0;
    this.peakDecoded = 0;
    this.disposed = false;

    // fila de busca: pontas das cenas, T1 inteira, depois cada cena do grosso para o fino
    const order = [];
    const seen = new Set();
    const push = (g) => {
      if (g >= 0 && g < this.total && !seen.has(g)) {
        seen.add(g);
        order.push(g);
      }
    };
    for (const s of scenes) push(this.offsets[s.id]);
    const first = scenes[0];
    this.essential = new Set([...scenes.map((s) => this.offsets[s.id])]);
    for (const s of scenes) {
      const o = this.offsets[s.id];
      for (const stride of [coarse, 4, 2, 1]) for (let i = 0; i < s.count; i += stride) push(o + i);
      push(o + s.count - 1);
      if (s === first) for (let i = 0; i < s.count; i++) this.essential.add(o + i);
    }
    this.queue = order;
    let resolveReady;
    this.ready = new Promise((r) => (resolveReady = r));
    this.resolveReady = resolveReady;
    this.essentialLeft = this.essential.size;
  }

  /** Começa a baixar. `onProgress(0..1)` acompanha o essencial (para o preloader da Fase 4). */
  start(onProgress) {
    this.onProgress = onProgress;
    for (let i = 0; i < FETCH_CONCURRENCY; i++) this.fetchNext();
  }

  async fetchNext() {
    while (!this.disposed && this.queue.length) {
      const g = this.queue.shift();
      try {
        const res = await fetch(this.urls[g]);
        if (!res.ok) throw new Error(res.status);
        this.blobs[g] = await res.blob();
      } catch {
        console.warn(`Quadro não carregou: ${this.urls[g]}`);
      }
      this.fetched++;
      if (this.essential.has(g)) {
        this.essentialLeft--;
        this.onProgress?.(1 - this.essentialLeft / this.essential.size);
        if (this.essentialLeft === 0) this.resolveReady();
      }
      if (this.wanted(g)) this.pump();
    }
  }

  /** Janela de vizinhos: maior à frente, no sentido em que a pessoa está rolando (o mesmo total de memória). */
  get lo() {
    return this.current - Math.round(this.radius * (this.dir < 0 ? 1.5 : 0.5));
  }

  get hi() {
    return this.current + Math.round(this.radius * (this.dir < 0 ? 0.5 : 1.5));
  }

  /** Quadros que devem ficar decodificados com o quadro atual em `this.current`. */
  wanted(g) {
    if (g >= this.lo && g <= this.hi) return true;
    if (g % this.coarse === 0) return true;
    return g === this.total - 1;
  }

  /** Avisa qual quadro está na tela: decodifica os vizinhos e solta o que ficou longe. */
  setCurrent(g) {
    if (g === this.current) return;
    this.dir = Math.sign(g - this.current);
    this.current = g;
    for (const i of this.live) {
      if (!this.wanted(i)) {
        this.bitmaps[i].close();
        this.bitmaps[i] = null;
        this.live.delete(i);
        this.decodedCount--;
      }
    }
    this.pump();
  }

  /** Decodifica, por ordem de distância do quadro atual, o que falta da vizinhança e da amostra. */
  pump() {
    if (this.disposed) return;
    while (this.decoding.size < DECODE_CONCURRENCY) {
      let best = -1;
      let bestDist = Infinity;
      const lo = Math.max(0, this.lo);
      const hi = Math.min(this.total - 1, this.hi);
      const consider = (i) => {
        if (this.blobs[i] && !this.bitmaps[i] && !this.decoding.has(i)) {
          // à frente pesa menos na distância: o próximo quadro do caminho vem antes do de trás
          const d = (i - this.current) * (this.dir || 1) >= 0 ? Math.abs(i - this.current) : Math.abs(i - this.current) * 2;
          if (d < bestDist) {
            best = i;
            bestDist = d;
          }
        }
      };
      for (let i = lo; i <= hi; i++) consider(i);
      if (best < 0) for (let i = 0; i < this.total; i += this.coarse) consider(i);
      if (best < 0) consider(this.total - 1);
      if (best < 0) return;
      this.decode(best);
    }
  }

  /** Decodificador fora da linha principal (Web Worker); sem suporte, decodifica aqui mesmo. */
  decodeBlob(g) {
    if (this.worker === undefined) {
      try {
        // medido no celular com CPU 4x: 3,3% de quadros lentos decodificando aqui, 1,1% com o ajudante
        this.worker = new Worker(new URL("./decoder.worker.js", import.meta.url), { type: "module" });
        this.waiting = new Map();
        if (this.worker) {
          this.worker.onmessage = ({ data }) => {
            this.waiting.get(data.g)?.(data.bmp);
            this.waiting.delete(data.g);
          };
          this.worker.onerror = () => {
            // o ajudante falhou: volta a decodificar aqui e reenvia o que estava pendente
            this.worker = null;
            for (const [i, resolve] of this.waiting) createImageBitmap(this.blobs[i]).then(resolve, () => resolve(null));
            this.waiting.clear();
          };
        }
      } catch {
        this.worker = null;
      }
    }
    if (!this.worker) return createImageBitmap(this.blobs[g]);
    return new Promise((resolve) => {
      this.waiting.set(g, resolve);
      this.worker.postMessage({ g, blob: this.blobs[g] });
    });
  }

  async decode(g) {
    this.decoding.add(g);
    try {
      const bmp = await this.decodeBlob(g);
      if (!bmp) throw new Error("sem imagem");
      if (this.disposed || !this.wanted(g)) {
        bmp.close();
      } else {
        this.bitmaps[g] = bmp;
        this.live.add(g);
        this.decodedCount++;
        this.peakDecoded = Math.max(this.peakDecoded, this.decodedCount);
        this.onFrame?.(g);
      }
    } catch {
      console.warn(`Quadro não decodificou: ${this.urls[g]}`);
    } finally {
      this.decoding.delete(g);
      this.pump();
    }
  }

  /** Índice global do quadro i da cena `id`. */
  index(id, i) {
    return this.offsets[id] + i;
  }

  /** O quadro g pronto, ou o pronto mais próximo (null se nenhum). */
  get(g) {
    if (this.bitmaps[g]) return this.bitmaps[g];
    for (let d = 1; d < this.total; d++) {
      const a = this.bitmaps[g - d];
      if (a) return a;
      const b = this.bitmaps[g + d];
      if (b) return b;
    }
    return null;
  }

  /** Memória estimada dos quadros decodificados agora e no pico (MB). */
  memoryMB(bytesPerFrame) {
    return { agora: (this.decodedCount * bytesPerFrame) / 1048576, pico: (this.peakDecoded * bytesPerFrame) / 1048576 };
  }

  dispose() {
    this.disposed = true;
    this.queue = [];
    this.worker?.terminate();
    this.worker = null;
    for (const i of this.live) this.bitmaps[i].close();
    this.live.clear();
    this.bitmaps.fill(null);
  }
}
