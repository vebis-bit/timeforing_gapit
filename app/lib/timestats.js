import { listEmployees } from "./employees";
import { isRedDay } from "./holidays";
import { fetchPaged, toNumber, todayInOslo, tripletexGetRetry, yesterdayInOslo } from "./tripletex";

const FALLBACK_HOURS_PER_DAY = 7.5;

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function companyHoursPerDay(date) {
  try {
    const data = await tripletexGetRetry("/salary/settings/standardTime/byDate", {
      date,
      fields: "hoursPerDay"
    });
    const hours = toNumber(data?.value?.hoursPerDay);
    return hours > 0 ? hours : FALLBACK_HOURS_PER_DAY;
  } catch {
    return FALLBACK_HOURS_PER_DAY;
  }
}

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = null;

/**
 * Plusstid for i går per ansatt = timer ført i går − dagsnorm.
 * Dagsnorm = firmaets timer per dag (Tripletex) × stillingsandel (Tripletex),
 * satt til 0 på lør/søn og norske helligdager.
 *
 * Resultatet caches i minnet i 10 minutter så gjentatte sidevisninger ikke
 * belaster Tripletex på nytt (data for "i går" endrer seg lite).
 */
export async function getYesterdayPlusstid({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }
  const data = await computeYesterdayPlusstid();
  cache = { at: Date.now(), data };
  return data;
}

async function computeYesterdayPlusstid() {
  const date = yesterdayInOslo();
  const red = isRedDay(date);

  const [employees, entries, hoursPerDay] = await Promise.all([
    listEmployees(),
    // Tripletex behandler dateTo som eksklusiv, så "kun i går" = [i går, i dag).
    fetchPaged("/timesheet/entry", {
      dateFrom: date,
      dateTo: todayInOslo(),
      fields: "employee(id),hours"
    }),
    companyHoursPerDay(date)
  ]);

  const hoursByEmployee = new Map();
  for (const entry of entries) {
    const id = String(entry?.employee?.id || "");
    if (!id) continue;
    hoursByEmployee.set(id, toNumber(hoursByEmployee.get(id)) + toNumber(entry.hours));
  }

  const rows = employees.map((employee) => {
    const hours = toNumber(hoursByEmployee.get(employee.id));
    const standardHours = employee.active && !red ? round2(hoursPerDay * employee.fraction) : 0;
    return {
      id: employee.id,
      name: employee.name,
      active: employee.active,
      hours,
      standardHours,
      plusstid: round2(hours - standardHours)
    };
  });

  return { date, redDay: red, hoursPerDay, rows };
}
