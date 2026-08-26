import { employeeName, fetchPaged, toNumber, yesterdayInOslo } from "./tripletex";

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = null;

// Finn arbeidsforholdet som dekker datoen, og les stillingsandel (1 = 100 %).
// Ingen employments-data => antas aktiv 100 % (Tripletex returnerer ikke feltet
// for alle). Regnes bare som inaktiv når vi FAKTISK har arbeidsforhold og ingen
// av dem dekker datoen.
function employmentInfo(employee, date) {
  const employments = Array.isArray(employee.employments) ? employee.employments : [];
  if (employments.length === 0) return { active: true, fraction: 1 };
  const active = employments.find(
    (row) => (!row.startDate || row.startDate <= date) && (!row.endDate || row.endDate >= date)
  );
  if (!active) return { active: false, fraction: 0 };
  const percent = toNumber(active?.latestSalary?.percentageOfFullTimeEquivalent);
  return { active: true, fraction: percent > 0 ? percent / 100 : 1 };
}

async function fetchRaw() {
  try {
    return await fetchPaged("/employee", {
      fields:
        "id,firstName,lastName,displayName,employments(startDate,endDate,latestSalary(percentageOfFullTimeEquivalent))"
    });
  } catch {
    // Feltutvidelsen kan være treg/ustabil – fall tilbake til enkel liste.
    return fetchPaged("/employee", { fields: "id,firstName,lastName,displayName" });
  }
}

/** [{ id, name, active, fraction }] for alle ansatte. Cachet i 10 minutter. */
export async function listEmployees({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const date = yesterdayInOslo();
  const raw = await fetchRaw();
  const data = raw
    .map((employee) => {
      const info = employmentInfo(employee, date);
      return {
        id: String(employee.id),
        name: employeeName(employee),
        active: info.active,
        fraction: info.fraction
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "no"));
  cache = { at: Date.now(), data };
  return data;
}
