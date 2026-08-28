// Poengmodellen – kjernen i gamifiseringen.
//
// Idé: en ansatt tjener +10 poeng for hver ARBEIDSDAG de fører timene sine "i
// tide". "I tide" = alle føringene for den dagen ble opprettet samme dag, eller
// inntil MAX_DAYS_EARLY dager før. Ført inn for sent (etter arbeidsdagen) eller
// mer enn 1 dag for tidlig => 0 poeng for dagen.
//
// Opprettelsestidspunktet leses fra `entry.changes` (Tripletex sitt endrings-
// logg-felt) – vi ser på det tidligste CREATE-tidsstempelet.
//
// getRegistrationScore() henter alle føringer for målmåneden + måneden før i ett
// kall, og teller opp per ansatt for fire perioder: måneden, denne uka, i går,
// og forrige måned (sistnevnte til sammenlikningsstreken). Resultatet caches i
// 10 min per måned.

import { isRedDay } from "./holidays";
import { fetchPaged, osloDateParts, toNumber } from "./tripletex";

export const POINTS_PER_ONTIME_DAY = 10;
const MAX_DAYS_EARLY = 1;

const CACHE_TTL_MS = 10 * 60 * 1000;
// Én cache-nøkkel per måned ("current" for inneværende, ellers "YYYY-MM").
const cache = new Map();

// Tall til to sifre: 5 -> "05".
function pad(n) {
  return String(n).padStart(2, "0");
}

// "YYYY-MM-DD" for et Date-objekt, i Oslo-tid.
function osloDate(date) {
  const { year, month, day } = osloDateParts(date);
  return `${year}-${month}-${day}`;
}

// Månedsnavn til visning, f.eks. "august 2026" (norsk).
function monthName(year, month) {
  return new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(Number(year), Number(month) - 1, 1))
  );
}

// Virkedager (ikke lør/søn/helligdag) i en måned, innenfor [1, lastDay].
// Returnerer en liste med "YYYY-MM-DD".
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
// Positivt = ført på forhånd, 0 = samme dag, negativt = ført i etterkant.
function daysAfter(createdIso, workIso) {
  return Math.round((Date.parse(workIso) - Date.parse(createdIso)) / 86_400_000);
}

// Teller opp per ansatt for et gitt sett med dager (kun dager i `days` telles):
// { [employeeId]: { workedDays, onTimeDays, lateDays, points } }.
// En dag teller som "worked" hvis personen førte > 0 timer den dagen; som
// "onTime" hvis ingen av føringene den dagen var utenfor tidsvinduet.
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

// Bygger poeng for én målmåned. `month` = "YYYY-MM" for en tidligere måned, som
// telles i sin helhet. null = inneværende måned, som telles t.o.m. i går og som
// også tar med "denne uka" og "i går".
//
// Returnerer:
//   { month, historical, monthLabel, workdays,
//     perEmployee,                 // hele målmåneden
//     week: { workdays, perEmployee } | null,
//     yesterday: { date, perEmployee } | null,
//     prev: { monthLabel, workdays, perEmployee } }   // måneden før målmåneden
async function computeScore(month = null) {
  const now = osloDateParts();
  const curYear = Number(now.year);
  const curMonth = Number(now.month);
  const curKey = `${now.year}-${now.month}`;

  let tYear = curYear;
  let tMonth = curMonth;
  const historical = Boolean(month && /^\d{4}-\d{2}$/.test(month) && month < curKey);
  if (historical) {
    tYear = Number(month.slice(0, 4));
    tMonth = Number(month.slice(5, 7));
  }

  const targetLastDay = new Date(Date.UTC(tYear, tMonth, 0)).getUTCDate();
  // Inneværende måned telles bare t.o.m. i går; tidligere måneder i sin helhet.
  const lastCountedDay = historical ? targetLastDay : Number(now.day) - 1;

  // Forrige måned relativt til målmåneden (for sammenlikningsstreken).
  let pYear = tYear;
  let pMonth = tMonth - 1;
  if (pMonth === 0) {
    pMonth = 12;
    pYear -= 1;
  }
  const prevYear = String(pYear);
  const prevMonth = pad(pMonth);
  const prevLastDay = new Date(Date.UTC(pYear, pMonth, 0)).getUTCDate();

  const targetYear = String(tYear);
  const targetMonth = pad(tMonth);
  const targetDays = weekdaysInMonth(targetYear, targetMonth, Math.max(0, lastCountedDay));
  const prevDays = weekdaysInMonth(prevYear, prevMonth, prevLastDay);

  // Hentevindu: 1. i forrige måned t.o.m. (eksklusiv) dagen etter siste talte dag.
  const dateFrom = `${prevYear}-${prevMonth}-01`;
  const dateTo = historical
    ? osloDate(new Date(Date.UTC(tYear, tMonth - 1, lastCountedDay + 1)))
    : osloDate(new Date());

  const entries = await fetchPaged("/timesheet/entry", {
    dateFrom,
    dateTo,
    fields: "date,employee(id),hours,changes"
  });

  const result = {
    month: `${targetYear}-${targetMonth}`,
    historical,
    monthLabel: monthName(targetYear, targetMonth),
    from: `${targetYear}-${targetMonth}-01`,
    to: targetDays[targetDays.length - 1] || `${targetYear}-${targetMonth}-01`,
    workdays: targetDays.length,
    perEmployee: tallyForDays(entries, targetDays),
    week: null,
    yesterday: null,
    prev: {
      monthLabel: monthName(prevYear, prevMonth),
      workdays: prevDays.length,
      perEmployee: tallyForDays(entries, prevDays)
    }
  };

  if (!historical) {
    const todayStr = osloDate(new Date());
    const yesterdayStr = osloDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    // Virkedager i inneværende ISO-uke, fra mandag t.o.m. i går.
    const td = new Date(Date.UTC(curYear, curMonth - 1, Number(now.day)));
    const mondayStr = osloDate(
      new Date(td.getTime() - ((td.getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000)
    );
    const weekDays = [...prevDays, ...targetDays].filter(
      (ds) => ds >= mondayStr && ds < todayStr
    );
    result.week = {
      workdays: weekDays.length,
      perEmployee: tallyForDays(entries, weekDays)
    };
    result.yesterday = {
      date: yesterdayStr,
      perEmployee: tallyForDays(entries, [yesterdayStr])
    };
  }

  return result;
}

/**
 * Poeng for én måned, cachet i 10 min. `month` = "YYYY-MM" (tidligere måned)
 * eller null (inneværende). `force: true` hopper over cachen.
 */
export async function getRegistrationScore({ force = false, month = null } = {}) {
  const key = month || "current";
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const data = await computeScore(month);
  cache.set(key, { at: Date.now(), data });
  return data;
}

// Slår sammen medlemmenes tall til ett gruppetall. `source` er et objekt med
// `perEmployee` (score selv, score.week, score.yesterday eller score.prev).
// Returnerer { points, workedDays, onTimeDays, lateDays, punctuality } der
// punctuality = onTimeDays / workedDays i prosent (null hvis ingen førte dager).
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
