// POST /api/admin/login – body { username, password }. Rett innlogging => sett
// signert httpOnly-sesjonscookie og { ok: true }. Feil => 401.

import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  checkCredentials,
  cookieOptions,
  isHttpsRequest,
  sessionValue
} from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body || {};

  if (!checkCredentials(username, password)) {
    return Response.json({ error: "Feil brukernavn eller passord." }, { status: 401 });
  }

  const store = await cookies();
  store.set(COOKIE_NAME, sessionValue(), { ...cookieOptions, secure: isHttpsRequest(request) });
  return Response.json({ ok: true });
}
