// Produtos: embalagem desenhada em SVG (pacote fosco com válvula e rótulo da Crema), uma cor por café.
// TODO: trocar por fotos reais dos produtos quando a marca existir.
const BAGS = {
  minas: { accent: "#D08A3E", origin: "Sul de Minas", country: "Brasil" },
  huila: { accent: "#C0583A", origin: "Huila", country: "Colômbia" },
  sidamo: { accent: "#9B7FB4", origin: "Sidamo", country: "Etiópia" },
  casa: { accent: "#8A6A4A", origin: "Da Casa", country: "Blend" },
};

function bagSVG({ accent, origin, country }, id) {
  return `
  <svg viewBox="0 0 240 320" role="presentation" focusable="false">
    <defs>
      <linearGradient id="bag-${id}" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#0b0a09"/>
        <stop offset="0.22" stop-color="#1d1a18"/>
        <stop offset="0.5" stop-color="#151311"/>
        <stop offset="0.82" stop-color="#1c1917"/>
        <stop offset="1" stop-color="#090807"/>
      </linearGradient>
      <linearGradient id="bag-shine-${id}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.08"/>
        <stop offset="0.4" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- corpo do pacote: um pouco mais largo embaixo, fundo arredondado -->
    <path d="M44 22 H196 Q204 22 205 30 L214 292 Q215 306 201 308 H39 Q25 306 26 292 L35 30 Q36 22 44 22 Z" fill="url(#bag-${id})"/>
    <path d="M44 22 H196 Q204 22 205 30 L214 292 Q215 306 201 308 H39 Q25 306 26 292 L35 30 Q36 22 44 22 Z" fill="url(#bag-shine-${id})"/>
    <!-- solda de cima e vincos -->
    <rect x="36" y="22" width="168" height="16" rx="3" fill="#24201d"/>
    <path d="M40 30 H200" stroke="#000" stroke-opacity="0.5" stroke-width="1" stroke-dasharray="2 3"/>
    <path d="M60 44 Q58 170 56 300" stroke="#fff" stroke-opacity="0.04" stroke-width="10" fill="none"/>
    <!-- válvula -->
    <circle cx="120" cy="66" r="9" fill="#100e0d" stroke="#2c2724" stroke-width="2"/>
    <circle cx="120" cy="66" r="3" fill="#2c2724"/>
    <!-- rótulo -->
    <rect x="58" y="104" width="124" height="150" rx="3" fill="#F2EADF"/>
    <rect x="58" y="104" width="124" height="10" rx="3" fill="${accent}"/>
    <text x="120" y="158" text-anchor="middle" font-family="Instrument Serif, serif" font-size="34" fill="#0b0a09">Crema</text>
    <line x1="80" y1="172" x2="160" y2="172" stroke="#0b0a09" stroke-opacity="0.25"/>
    <text x="120" y="196" text-anchor="middle" font-family="Instrument Serif, serif" font-style="italic" font-size="17" fill="#0b0a09">${origin}</text>
    <text x="120" y="216" text-anchor="middle" font-family="Inter Tight Variable, sans-serif" font-size="9.5" letter-spacing="0.6" fill="#0b0a09" fill-opacity="0.62">${country}</text>
    <text x="120" y="242" text-anchor="middle" font-family="Inter Tight Variable, sans-serif" font-size="9" fill="#0b0a09" fill-opacity="0.5">250 g em grãos</text>
  </svg>`;
}

export function initProdutos(root) {
  root.querySelectorAll(".produto").forEach((card, i) => {
    const bag = BAGS[card.dataset.bag];
    const visual = card.querySelector(".produto__visual");
    if (bag && visual) visual.innerHTML = bagSVG(bag, i);
  });
}
