import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

const DATA_DIR = path.join(process.cwd(), "data");
const GROUPS_FILE = path.join(DATA_DIR, "groups.json");
const BLOB_PATH = "groups.json";
// Storen er satt opp med privat tilgang: blob-en er ikke lesbar via en offentlig
// URL, og lesing må gå gjennom get() med samme token.
const BLOB_ACCESS = "private";

// På Vercel er filsystemet skrivebeskyttet i produksjon, så gruppene lagres i
// Vercel Blob når et Blob-token finnes (injiseres automatisk når en Blob-store
// er koblet til prosjektet). Lokalt uten token faller vi tilbake til
// data/groups.json som før.
//
// Kobler man flere Blob-stores til samme prosjekt, får de prefiksede navn som
// `<store>_BLOB_READ_WRITE_TOKEN`, ikke bare `BLOB_READ_WRITE_TOKEN`. Godta hvilken
// som helst variabel som slutter på BLOB_READ_WRITE_TOKEN.
function resolveBlobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  for (const [key, value] of Object.entries(process.env)) {
    if (value && key.endsWith("BLOB_READ_WRITE_TOKEN")) return value;
  }
  return null;
}

const blobToken = resolveBlobToken();
const useBlob = Boolean(blobToken);

// På Vercel finnes det ikke noe varig filsystem. Hvis Blob-tokenet mangler der,
// vil filsystem-fallbacken se ut til å lykkes, men dataen forsvinner mellom kall.
// Da er det bedre å feile tydelig så admin-siden viser en ekte feilmelding.
function assertBackend() {
  if (process.env.VERCEL && !useBlob) {
    throw new Error(
      "Vercel Blob er ikke satt opp: fant ingen *BLOB_READ_WRITE_TOKEN i miljøet. " +
        "Koble nøyaktig én Blob-store til prosjektet og redeploy."
    );
  }
}

const EMPTY = { groups: [] };

function normalize(raw) {
  const rawGroups = Array.isArray(raw?.groups) ? raw.groups : [];
  // En person kan bare være i én gruppe. Ved kollisjon beholdes personen i den
  // første gruppa den står i.
  const seen = new Set();
  return {
    groups: rawGroups
      .filter((group) => group && typeof group === "object")
      .map((group) => {
        const memberIds = [];
        if (Array.isArray(group.memberIds)) {
          for (const raw of group.memberIds) {
            const id = String(raw);
            if (seen.has(id)) continue;
            seen.add(id);
            memberIds.push(id);
          }
        }
        let captainId = group.captainId != null ? String(group.captainId) : null;
        // Kapteinen må være medlem av gruppa.
        if (captainId && !memberIds.includes(captainId)) captainId = null;
        return {
          id: String(group.id || randomUUID()),
          name: typeof group.name === "string" ? group.name : "Uten navn",
          memberIds,
          captainId
        };
      })
  };
}

async function readFromFile() {
  try {
    const text = await readFile(GROUPS_FILE, "utf8");
    return normalize(JSON.parse(text));
  } catch (error) {
    if (error.code === "ENOENT") return { ...EMPTY };
    throw error;
  }
}

async function writeToFile(data) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(GROUPS_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return data;
}

async function readFromBlob() {
  let result;
  try {
    result = await get(BLOB_PATH, { access: BLOB_ACCESS, useCache: false, token: blobToken });
  } catch (error) {
    if (error?.name === "BlobNotFoundError") return { ...EMPTY };
    throw error;
  }
  if (!result || !result.stream) return { ...EMPTY };
  const text = await new Response(result.stream).text();
  if (!text.trim()) return { ...EMPTY };
  return normalize(JSON.parse(text));
}

async function writeToBlob(data) {
  await put(BLOB_PATH, `${JSON.stringify(data, null, 2)}\n`, {
    access: BLOB_ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    token: blobToken
  });
  return data;
}

export async function readGroups() {
  assertBackend();
  return useBlob ? readFromBlob() : readFromFile();
}

export async function writeGroups(raw) {
  assertBackend();
  const data = normalize(raw);
  return useBlob ? writeToBlob(data) : writeToFile(data);
}
