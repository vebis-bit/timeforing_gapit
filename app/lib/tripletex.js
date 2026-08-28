// Lavnivå-klient mot Tripletex API v2.
//
// Autentisering: Tripletex bruker en tofase-modell. Consumer-token + employee-
// token byttes inn i et kortlevd "session token" (`/token/session/:create`),
// som så sendes som HTTP Basic-passord (brukernavn = firma-id / proxy-id).
// Session-tokenet caches i minnet ~55 min så vi slipper å lage ett per kall.

const API_BASE = process.env.TRIPLETEX_API_BASE || "https://tripletex.no/v2";
const PROXY_COMPANY_ID = process.env.TRIPLETEX_PROXY_COMPANY_ID || "0";
const PAGE_SIZE = 1000;

// { token, expiresAt } – gjeldende session-token, eller null.
let cachedSession = null;

// Les en påkrevd miljøvariabel, eller kast en tydelig feil hvis den mangler.
function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Mangler miljøvariabel: ${name}`);
  }
  return value;
}

// { year, month, day } som strenger ("2026", "08", "05") for en dato i Oslo-tid.
// Brukes overalt der vi trenger "hvilken kalenderdag er dette i Norge".
export function osloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: byType.year, month: byType.month, day: byType.day };
}

// "YYYY-MM-DD" for en dato, i Oslo-tid.
function osloDateString(date) {
  const { year, month, day } = osloDateParts(date);
  return `${year}-${month}-${day}`;
}

// "YYYY-MM-DD" for i går / i dag / i morgen, i Oslo-tid.
export function yesterdayInOslo() {
  return osloDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

export function todayInOslo() {
  return osloDateString(new Date());
}

function tomorrowInOslo() {
  return osloDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

// HTTP Basic-header av "brukernavn:passord".
function authHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

// Sørger for at bare ÉN session-token lages om gangen selv ved samtidige kall.
let sessionPromise = null;

// Bytter consumer+employee-token inn i et nytt session-token. Prøver 3 ganger;
// 5xx fra Tripletex regnes som forbigående. Kaster hvis alle forsøk feiler.
async function requestSessionToken() {
  const consumerToken = requiredEnv("TRIPLETEX_CONSUMER_TOKEN");
  const employeeToken = requiredEnv("TRIPLETEX_EMPLOYEE_TOKEN");
  const params = new URLSearchParams({
    consumerToken,
    employeeToken,
    expirationDate: tomorrowInOslo()
  });
  const url = `${API_BASE}/token/session/:create?${params.toString()}`;

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000)
      });
      if (!response.ok) {
        const body = await response.text();
        // 5xx fra Tripletex er som regel forbigående – prøv igjen.
        if (response.status >= 500 && attempt < 2) {
          lastError = new Error(`Session token ${response.status}: ${body}`);
          await sleep(1000 * (attempt + 1));
          continue;
        }
        throw new Error(`Klarte ikke å lage session token (${response.status}): ${body}`);
      }
      const data = await response.json();
      const token = data?.value?.token;
      if (!token) throw new Error("Tripletex svarte uten session token.");
      return token;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(1000 * (attempt + 1));
    }
  }
  throw lastError;
}

// Returnerer et gyldig session-token: fra cache hvis det har > 1 min igjen,
// ellers lages et nytt (og caches ~55 min). Samtidige kall deler samme løfte.
async function createSessionToken() {
  const now = Date.now();
  if (cachedSession && cachedSession.expiresAt > now + 60_000) {
    return cachedSession.token;
  }
  // Slå sammen samtidige forespørsler så vi ikke lager flere sesjoner på rad.
  if (!sessionPromise) {
    sessionPromise = requestSessionToken()
      .then((token) => {
        cachedSession = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
        return token;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

// Autentisert GET mot Tripletex. `path` er f.eks. "/timesheet/entry", `query`
// er et objekt med query-parametre. Returnerer parset JSON. Kaster ved ikke-2xx
// eller timeout (25 s).
export async function tripletexGet(path, query = {}) {
  const sessionToken = await createSessionToken();
  const params = new URLSearchParams(query);
  const url = `${API_BASE}${path}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: authHeader(PROXY_COMPANY_ID, sessionToken)
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tripletex-kall feilet (${response.status}) mot ${path}: ${body}`);
  }

  return response.json();
}

// Som tripletexGet, men henter ALLE sider (Tripletex paginerer med from/count).
// Returnerer én flat liste med alle `values`.
export async function fetchPaged(path, query = {}) {
  const rows = [];
  let from = 0;

  while (true) {
    const data = await tripletexGet(path, {
      ...query,
      count: String(PAGE_SIZE),
      from: String(from)
    });
    const page = Array.isArray(data?.values) ? data.values : [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

// Beste tilgjengelige visningsnavn for en ansatt fra Tripletex.
export function employeeName(employee) {
  if (!employee) return "Uten navn";
  const firstLast = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
  return employee.displayName || firstLast || employee.name || String(employee.id || "Uten navn");
}

// Trygg tallkonvertering: alt som ikke blir et endelig tall blir 0.
export function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Promise som resolver etter `ms` millisekunder.
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// tripletexGet med enkel retry (økende pause mellom forsøk). Brukes for kall
// der en enkelt feil ikke bør velte hele siden.
export async function tripletexGetRetry(path, query = {}, tries = 3) {
  let lastError;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await tripletexGet(path, query);
    } catch (error) {
      lastError = error;
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastError;
}

// Kjør `fn` over `items` med maks `limit` samtidige. Bevarer rekkefølgen i
// resultatet. (Parallell map med begrenset samtidighet.)
export async function pMap(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

export { createSessionToken };
