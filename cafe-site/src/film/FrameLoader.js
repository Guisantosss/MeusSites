// Quadros do filme com memória limitada. Baixar e decodificar fica no ajudante (frames.worker.js), fora da linha
// principal: aqui só se decide QUAIS quadros ficam prontos para desenhar.
//
// Busca (no ajudante): heads.pack (1º quadro de cada cena), o pacote da 1ª cena inteiro (o preloader espera só por
// isso), depois os outros pacotes. Dentro de cada pacote os quadros vêm do grosso para o fino.
// Memória: os quadros comprimidos (~30 a 40 KB cada) ficam no ajudante. Decodificado (ImageBitmap, ~5,8 MB no
// notebook e ~2,6 MB no celular) só fica a vizinhança do quadro atual (maior à frente, no sentido da rolagem), uma
// amostra (1 a cada N) e o último quadro; o resto é liberado. Sem isso, os ~380 quadros decodificados passariam de
// 1,5 GB e o iPhone fecharia a aba.
// Se o quadro pedido ainda não está pronto, `get()` devolve o pronto mais próximo e pede o exato com prioridade.
// Medido antes desta versão: 379 arquivos soltos custavam ~690 ms de bloqueio da página no Lighthouse do celular.

const DECODE_CONCURRENCY = 3;

export class FrameLoader {
  /**
   * @param {object} o
   * @param {string} o.base     pasta dos pacotes deste modo (ex.: "./frames/desktop/")
   * @param {{id: string, count: number}[]} o.scenes  cenas com quadros, na ordem do filme
   * @param {object} o.packs    manifest.packs[modo] (onde cada quadro está em cada pacote)
   * @param {number} o.radius   vizinhos decodificados do quadro atual
   * @param {number} o.coarse   amostra sempre decodificada (1 a cada N): rolagem rápida sempre tem um quadro perto
   * @param {() => void} o.onFrame chamado quando um quadro novo fica pronto para desenhar
   */
  constructor({ base, scenes, packs, radius, coarse = 8, onFrame }) {
    this.base = base;
    this.packs = packs;
    this.radius = radius;
    this.coarse = coarse;
    this.onFrame = onFrame;
    this.offsets = {};
    this.scenes = [];
    let total = 0;
    for (const s of scenes) {
      this.offsets[s.id] = total;
      this.scenes.push({ id: s.id, offset: total, count: s.count, pack: packs.scenes[s.id] });
      total += s.count;
    }
    this.total = total;
    this.available = new Uint8Array(total); // 1 = o ajudante já tem o quadro comprimido
    this.availableCount = 0;
    this.bitmaps = new Array(total).fill(null);
    this.live = new Set(); // índices com ImageBitmap pronta
    this.decoding = new Set();
    this.waiting = new Map();
    this.current = 0;
    this.dir = 1;
    this.decodedCount = 0;
    this.peakDecoded = 0;
    this.disposed = false;
    let resolveReady;
    this.ready = new Promise((r) => (resolveReady = r));
    this.resolveReady = resolveReady;
  }

  /** Começa a baixar. `onProgress(0..1)` acompanha o essencial (para o preloader). */
  start(onProgress) {
    try {
      this.worker = new Worker(new URL("./frames.worker.js", import.meta.url), { type: "module" });
    } catch {
      this.worker = null;
    }
    if (!this.worker) {
      this.resolveReady(); // navegador sem ajudante: o filme segue no modo provisório onde faltar quadro
      return;
    }
    this.worker.onmessage = ({ data }) => {
      if (data.type === "have") {
        let relevant = false;
        for (const g of data.list) {
          if (!this.available[g]) {
            this.available[g] = 1;
            this.availableCount++;
            if (this.wanted(g)) relevant = true;
          }
        }
        if (relevant) this.pump();
      } else if (data.type === "progress") {
        onProgress?.(data.p);
      } else if (data.type === "ready") {
        this.resolveReady();
      } else if (data.type === "decoded") {
        this.waiting.get(data.g)?.(data.bmp);
        this.waiting.delete(data.g);
      } else if (data.type === "error") {
        console.warn(`Quadros: ${data.message}`);
      }
    };
    this.worker.onerror = () => {
      console.warn("O ajudante dos quadros falhou; o filme segue com o que já estiver pronto.");
      for (const resolve of this.waiting.values()) resolve(null);
      this.waiting.clear();
      this.resolveReady();
    };
    // endereço completo: dentro do ajudante, um caminho relativo ("./frames/...") seria resolvido a partir do arquivo
    // dele (assets/), e não da página. No site publicado isso dava 404 (no modo de desenvolvimento o caminho é absoluto)
    const base = new URL(this.base, document.baseURI).href;
    this.worker.postMessage({ type: "init", base, heads: this.packs.heads, scenes: this.scenes, essential: this.scenes[0]?.id });
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
    if (this.disposed || !this.worker) return;
    while (this.decoding.size < DECODE_CONCURRENCY) {
      let best = -1;
      let bestDist = Infinity;
      const consider = (i) => {
        if (this.available[i] && !this.bitmaps[i] && !this.decoding.has(i)) {
          // à frente pesa menos na distância: o próximo quadro do caminho vem antes do de trás
          const d = (i - this.current) * (this.dir || 1) >= 0 ? Math.abs(i - this.current) : Math.abs(i - this.current) * 2;
          if (d < bestDist) {
            best = i;
            bestDist = d;
          }
        }
      };
      const lo = Math.max(0, this.lo);
      const hi = Math.min(this.total - 1, this.hi);
      for (let i = lo; i <= hi; i++) consider(i);
      if (best < 0) for (let i = 0; i < this.total; i += this.coarse) consider(i);
      if (best < 0) consider(this.total - 1);
      if (best < 0) return;
      this.decode(best);
    }
  }

  async decode(g) {
    this.decoding.add(g);
    const bmp = await new Promise((resolve) => {
      this.waiting.set(g, resolve);
      this.worker.postMessage({ type: "decode", g });
    });
    this.decoding.delete(g);
    if (bmp) {
      if (this.disposed || !this.wanted(g) || this.bitmaps[g]) {
        bmp.close();
      } else {
        this.bitmaps[g] = bmp;
        this.live.add(g);
        this.decodedCount++;
        this.peakDecoded = Math.max(this.peakDecoded, this.decodedCount);
        this.onFrame?.(g);
      }
    }
    this.pump();
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

  get fetched() {
    return this.availableCount;
  }

  dispose() {
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
    for (const i of this.live) this.bitmaps[i].close();
    this.live.clear();
    this.bitmaps.fill(null);
    for (const resolve of this.waiting.values()) resolve(null);
    this.waiting.clear();
  }
}
