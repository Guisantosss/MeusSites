// Fonte única da verdade do filme: cenas, pesos de rolagem e textos das etapas.
// Os pesos são o ponto de partida do plano; o ajuste fino é feito no navegador (Fase 3).

export const FILM = {
  scrollVh: 800, // comprimento total da rolagem do filme, em vh
  // trechos parados nas pontas (mesma unidade dos pesos das cenas):
  intro: 0.3, // a cereja fica parada enquanto o nome da marca sai de cena
  outro: 0.25, // a xícara fica parada com a etapa 05 na tela antes do filme soltar
  squareBelow: 768, // abaixo desta largura (ou com a tela em pé) o filme usa o recorte quadrado do celular
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
    // os últimos ~4 s são o grão girando devagar: recebem menos rolagem (curva dentro da cena, Fase 3)
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
    from: "K3_grao_torrado",
    to: "K4b_nuvem_inicio_T5",
    still: "K4b_nuvem_inicio_T5",
    alt: "O grão explodindo numa nuvem de café moído que toma a tela",
    weight: 0.8,
    zoom: 0.22, // a explosão: o grão avança contra a câmera enquanto vira pó
    step: { number: "04", title: "Moagem", text: "Moído na hora de virar café." },
  },
  {
    id: "t5",
    video: "T5_xicara", // TODO: o vídeo ainda não existe; até chegar, fusão K4b → K5 com pó caindo
    from: "K4b_nuvem_inicio_T5",
    to: "K5_xicara",
    still: "K5_xicara",
    alt: "Xícara preta com espresso e crema dourada, com vapor subindo",
    weight: 1.2,
    zoom: 0.08,
    dust: true, // partículas de pó caindo sobre a fusão (só enquanto não houver T5)
    step: { number: "05", title: "Extração", text: "9 bar. 25 segundos. Uma xícara." },
  },
];
