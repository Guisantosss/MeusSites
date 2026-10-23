// Modo provisório do filme: monta cada cena com as imagens-chave (fusão + leve avanço da câmera).
// Na Fase 3, quando os quadros extraídos existirem, uma fonte de quadros substitui esta com a mesma interface.
import { SCENES } from "../config/scenes.js";
import { easeInOutSine, smoothstep } from "./math.js";

const BASE = import.meta.env.BASE_URL;
const NAMES = [...new Set(SCENES.flatMap((s) => [s.from, s.to]))];
const FULL_BLEED = new Set(["K4b_nuvem_inicio_T5"]); // imagem que ocupa o quadro inteiro (sem fundo preto em volta)

export class KeyframeSource {
  /** @param names quais imagens-chave carregar (com os quadros reais, só as das cenas que ainda não têm vídeo) */
  constructor(onReady, names = NAMES) {
    this.onReady = onReady;
    this.names = names;
    this.mode = null;
    this.images = new Map(); // "mobile/K0_cereja" -> ImageBitmap (já decodificada e pronta para desenhar)
    this.warm = document.createElement("canvas").getContext("2d");
  }

  /** Carrega o conjunto do modo (desktop ou mobile). A K0 vem primeiro para a primeira tela aparecer logo. */
  async load(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    const loadOne = async (name) => {
      const key = `${mode}/${name}`;
      if (this.images.has(key)) return;
      const img = new Image();
      img.decoding = "async";
      img.src = `${BASE}img/keyframes/${mode}/${name}.webp`;
      try {
        await img.decode();
        // ImageBitmap fica decodificada de vez; desenhar uma vez num canvas de rascunho leva a imagem para a placa
        // de vídeo agora, e não no meio da rolagem (era o que causava as travadas na primeira passada)
        const bmp = await createImageBitmap(img);
        this.warm.drawImage(bmp, 0, 0, 2, 2);
        this.images.set(key, bmp);
        this.onReady();
      } catch {
        console.warn(`Imagem-chave não carregou: ${img.src}`);
      }
    };
    await loadOne(this.names[0]);
    await Promise.all(this.names.slice(1).map(loadOne));
  }

  /** A imagem do modo atual; se ainda não chegou, a do outro modo serve (o canvas recorta o quadrado). */
  get(name) {
    return this.images.get(`${this.mode}/${name}`) ?? this.images.get(`${this.mode === "mobile" ? "desktop" : "mobile"}/${name}`);
  }

  get firstReady() {
    return !!this.get(this.names[0]);
  }

  /** Camadas a desenhar no estado atual: [{ img, alpha, scale }] de baixo para cima.
   *  `fromImg` troca a imagem de saída (ex.: o último quadro real da T4 no lugar da K4b). */
  layers(state, fromImg = null) {
    const first = SCENES[0];
    const last = SCENES[SCENES.length - 1];
    if (state.kind === "intro") return [{ img: this.get(first.from), alpha: 1, scale: 1 }];
    // no epílogo quem aproxima é a câmera do canvas (em volta da crema), não a escala da camada
    if (state.kind === "outro") return [{ img: this.get(last.to), alpha: 1, scale: 1 }];

    const scene = SCENES[state.sceneIndex];
    const l = state.local;
    const t = smoothstep(0.12, 0.88, l); // a fusão acontece no miolo da cena
    const z = scene.zoom ?? 0.05;
    // A "câmera" avança o tempo todo: a imagem de saída cresce e a de entrada chega crescendo até o tamanho real,
    // então a emenda com a cena seguinte (que começa nesta mesma imagem, em escala 1) não pula.
    const from = { img: fromImg ?? this.get(scene.from), alpha: 1, scale: 1 + z * easeInOutSine(l) };
    const toScale = FULL_BLEED.has(scene.to) ? 1 + z * 0.3 * (1 - t) : 1 - z * 0.5 * (1 - t);
    const to = { img: this.get(scene.to), alpha: t, scale: toScale };
    if (t <= 0) return [from];
    if (t >= 1) return [to];
    return [from, to];
  }
}
