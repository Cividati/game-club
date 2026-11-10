const CFG = window.CLUBE_CONFIG || {};
export const TZ = CFG.TIMEZONE || "America/Sao_Paulo";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Data/hora "de parede" no fuso do clube. */
export function nowParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, min: +parts.minute };
}

/** Mês atual no formato "AAAA-MM". */
export function currentMonth(date) {
  const { y, m } = nowParts(date);
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function shiftMonth(key, delta) {
  let [y, m] = key.split("-").map(Number);
  m += delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function monthName(key, withYear = false) {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[m - 1];
  return withYear ? `${name} de ${y}` : name;
}

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Quanto falta para a votação do mês fechar. */
export function timeLeft(date) {
  const { y, m, d, h, min } = nowParts(date);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const minutesLeft = (daysInMonth - d) * 1440 + (24 - h) * 60 - min;
  const days = Math.floor(minutesLeft / 1440);
  const hours = Math.floor((minutesLeft % 1440) / 60);
  return { days, hours, minutesLeft, lastDay: `${String(daysInMonth).padStart(2, "0")}/${String(m).padStart(2, "0")}` };
}

/** Matiz determinística a partir de um texto (para a capa gerada). */
export function hues(text) {
  let h = 2166136261;
  for (const ch of text.toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  const h1 = Math.abs(h) % 360;
  return [h1, (h1 + 70 + (Math.abs(h >> 8) % 90)) % 360];
}

export function initials(title) {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Ordena para o ranking: mais votos, e no empate quem foi sugerido antes. */
export function byRank(a, b) {
  return b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at);
}

/** Criador de elementos que nunca interpreta texto do usuário como HTML. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export function svg(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstChild;
}

export function isSafeHttpsUrl(u) {
  try { return new URL(u).protocol === "https:"; } catch { return false; }
}
