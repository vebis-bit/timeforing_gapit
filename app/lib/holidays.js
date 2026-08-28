// Norske røde dager (bevegelige + faste). Julaften/nyttårsaften regnes ikke med.
// Brukes til å hoppe over dager ingen forventes å føre timer (helg + helligdag).

// Dato for 1. påskedag et gitt år (gregoriansk Computus / "Anonymous Gregorian
// algorithm"). Alle de bevegelige helligdagene regnes ut fra denne.
function easterSunday(year) {
  // Anonymous Gregorian algorithm (Computus).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

// "YYYY-MM-DD" fra et Date-objekt (UTC).
function iso(date) {
  return date.toISOString().slice(0, 10);
}

// Ny dato `days` dager fram/tilbake.
function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// year -> Set med "YYYY-MM-DD" for alle helligdager det året. Regnes én gang per år.
const holidayCache = new Map();

// Set med alle norske helligdager (faste + påske-/pinserelaterte) for et år.
function holidaysForYear(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const easter = easterSunday(year);
  const set = new Set([
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-05-17`,
    `${year}-12-25`,
    `${year}-12-26`,
    iso(addDays(easter, -3)), // Skjærtorsdag
    iso(addDays(easter, -2)), // Langfredag
    iso(easter), // Første påskedag
    iso(addDays(easter, 1)), // Andre påskedag
    iso(addDays(easter, 39)), // Kristi himmelfartsdag
    iso(addDays(easter, 49)), // Første pinsedag
    iso(addDays(easter, 50)) // Andre pinsedag
  ]);
  holidayCache.set(year, set);
  return set;
}

/** dateStr på formen "YYYY-MM-DD". Sann for lør/søn og norske helligdager. */
export function isRedDay(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (weekday === 0 || weekday === 6) return true;
  return holidaysForYear(year).has(dateStr);
}
