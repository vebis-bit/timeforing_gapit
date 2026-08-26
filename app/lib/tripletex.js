const API_BASE = process.env.TRIPLETEX_API_BASE || "https://tripletex.no/v2";
const PROXY_COMPANY_ID = process.env.TRIPLETEX_PROXY_COMPANY_ID || "0";
const PAGE_SIZE = 1000;

let cachedSession = null;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Mangler miljøvariabel: ${name}`);
  }
  return value;
}

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

function osloDateString(date) {
  const { year, month, day } = osloDateParts(date);
  return `${year}-${month}-${day}`;
}

export function yesterdayInOslo() {
  return osloDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

export function todayInOslo() {
  return osloDateString(new Date());
}

function tomorrowInOslo() {
  return osloDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

function authHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

let sessionPromise = null;

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

export function employeeName(employee) {
  if (!employee) return "Uten navn";
  const firstLast = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
  return employee.displayName || firstLast || employee.name || String(employee.id || "Uten navn");
}

export function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
