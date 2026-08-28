// Innlogging til /admin. Ingen brukerdatabase: ett brukernavn/passord fra env.
// "Sesjonen" er en HMAC-signert konstant lagt i en httpOnly-cookie – serveren
// verifiserer den ved å regne ut samme HMAC på nytt.

import crypto from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE_NAME = "gapit_admin";

// Felles cookie-innstillinger. `secure` settes per forespørsel (se under).
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 8
};

// `Secure` bare når forespørselen faktisk kom inn over HTTPS. Ellers ville en
// container kjørt over vanlig http (localhost / LAN uten TLS-proxy) sende en
// Secure-cookie som nettleseren forkaster – da blir man stående på «Logger inn …».
export function isHttpsRequest(request) {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

// Hemmeligheten som signerer sesjonscookien. Bruk alltid ADMIN_SESSION_SECRET i
// drift – fallbackene er kun for at det skal starte i utvikling.
function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "utrygt-standardhemmelighet-bytt-meg"
  );
}

// Den forventede cookie-verdien for en innlogget admin (HMAC av hemmeligheten).
// Endres hemmeligheten, blir alle gamle cookies ugyldige.
export function sessionValue() {
  return crypto.createHmac("sha256", sessionSecret()).update("admin:v1").digest("hex");
}

// Sann hvis brukernavn/passord stemmer med env. Tomt ADMIN_PASSWORD => nekt alt.
export function checkCredentials(username, password) {
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "";
  if (!expectedPass) return false;
  return username === expectedUser && password === expectedPass;
}

// Sann hvis den innkommende forespørselen har en gyldig admin-sesjonscookie.
// Kalles fra serverkomponenter og API-ruter for å gate admin-funksjonalitet.
export async function isAdmin() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === sessionValue();
}
