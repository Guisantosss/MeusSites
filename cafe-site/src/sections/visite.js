// Visite: o "aberto agora" é calculado no horário de São Paulo (vale para quem abre o site de qualquer lugar) e se
// atualiza a cada minuto. A foto do salão anda mais devagar que a página (paralaxe).
const HOURS = { open: 8, close: 18, days: [1, 2, 3, 4, 5, 6] }; // seg a sáb, das 8h às 18h. TODO: horário real
const ON_DAY = ["no domingo", "na segunda", "na terça", "na quarta", "na quinta", "na sexta", "no sábado"];
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Dia da semana (0 = domingo) e minutos desde a meia-noite, no horário de São Paulo. */
function nowInSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { day: WEEK.indexOf(get("weekday")), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function openStatus({ day, minutes }) {
  const open = HOURS.open * 60;
  const close = HOURS.close * 60;
  const today = HOURS.days.includes(day);
  if (today && minutes >= open && minutes < close) {
    const left = close - minutes;
    return { open: true, text: left <= 60 ? `Aberto agora · fecha em ${left} min` : `Aberto agora · fecha às ${HOURS.close}h` };
  }
  if (today && minutes < open) return { open: false, text: `Fechado agora · abre hoje às ${HOURS.open}h` };
  for (let d = 1; d <= 7; d++) {
    const next = (day + d) % 7;
    if (HOURS.days.includes(next)) {
      return { open: false, text: `Fechado agora · abre ${d === 1 ? "amanhã" : ON_DAY[next]} às ${HOURS.open}h` };
    }
  }
  return { open: false, text: "Fechado agora" };
}

export function initVisite({ gsap, reducedMotion }) {
  const section = document.getElementById("visite");
  if (!section) return;
  const status = section.querySelector(".visite__status");
  const label = status.querySelector(".visite__status-text");
  const refresh = () => {
    const s = openStatus(nowInSaoPaulo());
    status.classList.toggle("is-open", s.open);
    if (label.textContent !== s.text) label.textContent = s.text;
  };
  refresh();
  setInterval(refresh, 60_000);

  // a paralaxe é do CSS onde o navegador sabe prender animação à rolagem (sections.css); aqui só a reserva
  if (reducedMotion || CSS.supports("animation-timeline: view()")) return;
  gsap.fromTo(
    section.querySelector(".visite__bg img"),
    { yPercent: -7 },
    {
      yPercent: 7,
      ease: "none",
      scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true },
    },
  );
}
