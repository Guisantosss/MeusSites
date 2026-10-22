// Fonte única da verdade do filme: cenas, pesos de rolagem e textos das etapas.
// Os pesos são o ponto de partida do plano; o ajuste fino é feito no navegador (Fase 3).

export const FILM_SCROLL_VH = 800; // altura total da rolagem do filme, em vh

export const SCENES = [
  {
    id: "t1",
    video: "T1_cereja_abre",
    from: "K0_cereja",
    to: "K1_cereja_aberta",
    weight: 1.0,
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
    weight: 0.9,
    // os últimos ~4 s são o grão girando devagar: recebem menos rolagem (curva dentro da cena, Fase 3)
    step: { number: "02", title: "Seleção", text: "Só o melhor grão segue adiante." },
  },
  {
    id: "t3",
    video: "T3_torra",
    from: "K2_grao_verde",
    to: "K3_grao_torrado",
    weight: 1.2,
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
    weight: 0.8,
    step: { number: "04", title: "Moagem", text: "Moído na hora de virar café." },
  },
  {
    id: "t5",
    video: "T5_xicara", // TODO: o vídeo ainda não existe; até chegar, crossfade K4b → K5 com pó caindo
    from: "K4b_nuvem_inicio_T5",
    to: "K5_xicara",
    weight: 1.2,
    step: { number: "05", title: "Extração", text: "9 bar. 25 segundos. Uma xícara." },
  },
];
