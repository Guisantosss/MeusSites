// Fonte única da verdade do filme: cenas, pesos de rolagem e textos das etapas.
// Os pesos são o ponto de partida do plano; o ajuste fino é feito no navegador (Fase 3).

export const FILM = {
  // comprimento total da rolagem do filme, em vh: ~142 vh por unidade de peso (o ritmo acertado na Fase 3), para as
  // 6 cenas mais a abertura e o epílogo (0,3 + 6,1 + 1,5)
  scrollVh: 1120,
  // trechos nas pontas (mesma unidade dos pesos das cenas):
  intro: 0.3, // a cereja fica parada enquanto o nome da marca sai de cena
  outro: 1.5, // epílogo: a câmera mergulha na crema, o manifesto acende por cima e tudo escurece até o preto
  squareBelow: 768, // abaixo desta largura (ou com a tela em pé) o filme usa o recorte quadrado do celular
  // Epílogo sobre a última imagem do filme (o último quadro da T5b, igual à K5; se o vídeo mudar, conferir a crema).
  // focus: centro da crema, em fração da imagem de cada modo. zoom: quanto a câmera avança até o fim.
  epilogue: {
    desktop: { focus: { x: 0.495, y: 0.47 }, zoom: 2.5 },
    mobile: { focus: { x: 0.49, y: 0.48 }, zoom: 1.9 },
  },
};

export const SCENES = [
  {
    id: "t1",
    video: "T1_cereja_abre",
    from: "K0_cereja",
    to: "K1_cereja_aberta",
    still: "K0_cereja", // imagem da etapa no modo de movimento reduzido (alt: texto alternativo dela)
    alt: "Cereja de café vermelha e madura, com folha, flutuando sobre fundo preto",
    weight: 1.0,
    zoom: 0.05, // modo provisório: quanto a câmera "avança" durante a fusão
    step: {
      number: "01",
      title: "Colheita",
      text: "Colhido à mão, no ponto exato.",
      counter: { from: 0, to: 1200, unit: "m", label: "de altitude" },
    },
  },
  {
    id: "t2",
    video: "T2_grao_verde",
    from: "K1_cereja_aberta",
    to: "K2_grao_verde",
    still: "K2_grao_verde",
    alt: "Um grão de café verde, ainda cru, flutuando sobre fundo preto",
    weight: 0.9,
    zoom: 0.06,
    // os últimos ~4 s são o grão girando devagar: recebem menos rolagem.
    // timeMap = pares [fração da rolagem da cena, fração do tempo do vídeo]: 62% da rolagem cobre os 4 primeiros
    // segundos e os 38% finais cobrem o giro lento
    timeMap: [
      [0, 0],
      [0.62, 0.5],
      [1, 1],
    ],
    // o giro lento (últimos 4 s) recebe pouca rolagem: 8 fps bastam ali (peso dos pacotes no celular)
    fpsByTime: [
      [0, 12],
      [4, 8],
    ],
    step: { number: "02", title: "Seleção", text: "Só o melhor grão segue adiante." },
  },
  {
    id: "t3",
    video: "T3_torra",
    from: "K2_grao_verde",
    to: "K3_grao_torrado",
    still: "K3_grao_torrado",
    alt: "O mesmo grão já torrado, marrom-escuro, soltando fumaça",
    weight: 1.2,
    zoom: 0.04,
    step: {
      number: "03",
      title: "Torra",
      text: "Fogo lento. Paciência.",
      counter: { from: 0, to: 210, unit: "°C" },
    },
  },
  {
    id: "t4",
    video: "T4_explosao",
    cutAt: 3.75, // segundos: depois disso o grão "remonta" e isso nunca pode aparecer
    // [a partir de (s), fps]: até 2 s o grão só flutua (12 fps bastam); a explosão (2 a 3,75 s) é rápida e usa todos
    // os quadros, para a rolagem não andar aos pulos (o resto do filme usa 12)
    fpsByTime: [
      [0, 12],
      [2, 24],
    ],
    quality: { desktop: 56, mobile: 50 }, // pó: comprime mal e esconde a compressão (meta de peso do plano)
    from: "K3_grao_torrado",
    to: "K4b_nuvem_inicio_T5",
    still: "K4b_nuvem_inicio_T5",
    alt: "O grão explodindo numa nuvem de café moído que toma a tela",
    weight: 0.7,
    zoom: 0.22, // a explosão: o grão avança contra a câmera enquanto vira pó
    step: { number: "04", title: "Moagem", text: "Moído na hora de virar café." },
  },
  {
    id: "t5a",
    video: "T5a_dose", // o pó vira um redemoinho e cai no porta-filtro
    from: "K4b_nuvem_inicio_T5",
    to: "K4c_portafiltro",
    still: "K4c_portafiltro",
    alt: "Porta-filtro cheio de café moído sobre uma xícara preta vazia",
    weight: 1.0,
    zoom: 0.06,
    quality: { desktop: 60, mobile: 54 }, // redemoinho de pó (como a T4)
    step: {
      number: "05",
      title: "Dose",
      text: "18 gramas. Nem um a mais.",
      counter: { from: 0, to: 18, unit: "g" },
    },
  },
  {
    id: "t5b",
    video: "T5b_espresso", // água quente, o espresso escorre e a crema se forma; no fim o porta-filtro sobe e sai
    from: "K4c_portafiltro",
    to: "K5_xicara",
    still: "K5_xicara",
    alt: "Xícara preta com espresso e crema dourada, com vapor subindo",
    weight: 1.3,
    zoom: 0.08,
    // fim generoso (a xícara é a imagem do epílogo): 75% da rolagem cobre 90% do vídeo e os 25% finais ficam com
    // os últimos ~0,8 s, quando o porta-filtro sobe e a xícara aparece inteira
    timeMap: [
      [0, 0],
      [0.75, 0.9],
      [1, 1],
    ],
    step: { number: "06", title: "Extração", text: "9 bar. 25 segundos. Uma xícara." },
  },
];
