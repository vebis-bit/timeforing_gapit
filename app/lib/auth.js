import crypto from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE_NAME = "gapit_admin";

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 8,
  secure: process.env.NODE_ENV === "production"
};

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "utrygt-standardhemmelighet-bytt-meg"
  );
}

export function sessionValue() {
  return crypto.createHmac("sha256", sessionSecret()).update("admin:v1").digest("hex");
}

export function checkCredentials(username, password) {
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "";
  if (!expectedPass) return false;
  return username === expectedUser && password === expectedPass;
}

export async function isAdmin() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === sessionValue();
}
