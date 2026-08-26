import { isRedDay } from "./holidays";
import { fetchPaged, osloDateParts, toNumber } from "./tripletex";

// Poeng gis for å føre timer i riktig tid: samme dag, eller inntil MAX_DAYS_EARLY
// dager før arbeidsdagen. Føres timene inn for sent (etter arbeidsdagen) ELLER
// mer enn MAX_DAYS_EARLY dager for tidlig, gir det null poeng.
// Vinduet er inneværende kalendermåned.
export const POINTS_PER_ONTIME_DAY = 10;
const MAX_DAYS_EARLY = 1;

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = null;

function pad(n) {
  return String(n).padStart(2, "0");
}

function osloDate(date) {
  const { year, month, day } = osloDateParts(date);
  return `${year}-${month}-${day}`;
}

function monthName(year, month) {
  return new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(Number(year), Number(month) - 1, 1))
  );
}

// Virkedager (ikke lør/søn/helligdag) i en måned, innenfor [1, lastDay].
function weekdaysInMonth(year, month, lastDay) {
  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const ds = `${year}-${month}-${pad(d)}`;
    if (!isRedDay(ds)) days.push(ds);
  }
  return days;
}

// Datoen (Oslo) da føringen først ble opprettet. Null hvis ukjent.
function createdDate(changes) {
  if (!Array.isArray(changes) || changes.length === 0) return null;
  const creates = changes.filter((c) => c.changeType === "CREATE" && c.timestamp);
  const stamps = (creates.length ? creates : changes).map((c) => c.timestamp).filter(Boolean).sort();
  return stamps.length ? osloDate(new Date(stamps[0])) : null;
}

// Antall dager arbeidsdatoen ligger etter opprettelsesdatoen (begge "YYYY-MM-DD").
function daysAfter(createdIso, workIso) {
  return Math.round((Date.parse(workIso) - Date.parse(createdIso)) / 86_400_000);
}

// { [employeeId]: { workedDays, onTimeDays, lateDays, points } } for de gitte dagene.
function tallyForDays(entries, days) {
  const daySet = new Set(days);
  const perDay = new Map(); // id -> date -> { hours, offTime }
  for (const entry of entries) {
    const workDate = entry.date;
    if (!daySet.has(workDate)) continue;
    const id = String(entry?.employee?.id || "");
    if (!id) continue;
    if (!perDay.has(id)) perDay.set(id, new Map());
    const byDate = perDay.get(id);
    const rec = byDate.get(workDate) || { hours: 0, offTime: false };
    rec.hours += toNumber(entry.hours);
    const created = createdDate(entry.changes);
    if (created) {
      const diff = daysAfter(created, workDate);
      // For sent (diff < 0) eller mer enn MAX_DAYS_EARLY dager for tidlig.
      if (diff < 0 || diff > MAX_DAYS_EARLY) rec.offTime = true;
    }
    byDate.set(workDate, rec);
  }

  const perEmployee = {};
  for (const [id, byDate] of perDay) {
    let workedDays = 0;
    let onTimeDays = 0;
    let lateDays = 0;
    for (const rec of byDate.values()) {
      if (rec.hours <= 0) continue;
      workedDays += 1;
      if (rec.offTime) lateDays += 1;
      else onTimeDays += 1;
    }
    perEmployee[id] = { workedDays, onTimeDays, lateDays, points: onTimeDays * POINTS_PER_ONTIME_DAY };
  }
  return perEmployee;
}

async function computeScore() {
  const today = osloDateParts();
  const curYear = today.year;
  const curMonth = today.month;
  const yesterday = Number(today.day) - 1; // siste talte dag i inneværende måned

  // Forrige måned
  let pYear = Number(curYear);
  let pMonth = Number(curMonth) - 1;
  if (pMonth === 0) {
    pMonth = 12;
    pYear -= 1;
  }
  const prevYear = String(pYear);
  const prevMonth = pad(pMonth);
  const prevLastDay = new Date(Date.UTC(pYear, pMonth, 0)).getUTCDate();

  const currentDays = weekdaysInMonth(curYear, curMonth, Math.max(0, yesterday));
  const prevDays = weekdaysInMonth(prevYear, prevMonth, prevLastDay);

  const todayStr = osloDate(new Date());
  const yesterdayStr = osloDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

  // Virkedager i inneværende ISO-uke, fra mandag t.o.m. i går.
  const td = new Date(Date.UTC(Number(curYear), Number(curMonth) - 1, Number(today.day)));
  const mondayStr = osloDate(new Date(td.getTime() - ((td.getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000));
  const weekDays = [...prevDays, ...currentDays].filter((ds) => ds >= mondayStr && ds < todayStr);

  // Hent alle føringer fra 1. forrige måned t.o.m. i går (dateTo eksklusiv = i dag).
  const entries = await fetchPaged("/timesheet/entry", {
    dateFrom: `${prevYear}-${prevMonth}-01`,
    dateTo: todayStr,
    fields: "date,employee(id),hours,changes"
  });

  return {
    monthLabel: monthName(curYear, curMonth),
    from: `${curYear}-${curMonth}-01`,
    to: currentDays[currentDays.length - 1] || `${curYear}-${curMonth}-01`,
    workdays: currentDays.length,
    perEmployee: tallyForDays(entries, currentDays),
    week: {
      workdays: weekDays.length,
      perEmployee: tallyForDays(entries, weekDays)
    },
    yesterday: {
      date: yesterdayStr,
      perEmployee: tallyForDays(entries, [yesterdayStr])
    },
    prev: {
      monthLabel: monthName(prevYear, prevMonth),
      workdays: prevDays.length,
      perEmployee: tallyForDays(entries, prevDays)
    }
  };
}

export async function getRegistrationScore({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const data = await computeScore();
  cache = { at: Date.now(), data };
  return data;
}

// Slår sammen medlemmenes tall til ett gruppetall. `source` er et objekt med
// `perEmployee` (score selv, eller score.prev).
export function scoreForMembers(memberIds, source) {
  let points = 0;
  let workedDays = 0;
  let onTimeDays = 0;
  let lateDays = 0;
  for (const id of memberIds) {
    const s = source.perEmployee[String(id)];
    if (!s) continue;
    points += s.points;
    workedDays += s.workedDays;
    onTimeDays += s.onTimeDays;
    lateDays += s.lateDays;
  }
  const punctuality = workedDays > 0 ? Math.round((onTimeDays / workedDays) * 100) : null;
  return { points, workedDays, onTimeDays, lateDays, punctuality };
}
