import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { list, put } from "@vercel/blob";

const DATA_DIR = path.join(process.cwd(), "data");
const GROUPS_FILE = path.join(DATA_DIR, "groups.json");
const BLOB_PATH = "groups.json";

// På Vercel er filsystemet skrivebeskyttet i produksjon, så gruppene lagres i
// Vercel Blob når BLOB_READ_WRITE_TOKEN finnes (injiseres automatisk når en
// Blob-store er koblet til prosjektet). Lokalt uten token faller vi tilbake til
// data/groups.json som før.
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// På Vercel finnes det ikke noe varig filsystem. Hvis Blob-tokenet mangler der,
// vil filsystem-fallbacken se ut til å lykkes, men dataen forsvinner mellom kall.
// Da er det bedre å feile tydelig så admin-siden viser en ekte feilmelding.
function assertBackend() {
  if (process.env.VERCEL && !useBlob) {
    throw new Error(
      "Vercel Blob er ikke satt opp: BLOB_READ_WRITE_TOKEN mangler. Opprett en " +
        "Blob-store i Vercel (Storage), koble den til prosjektet, og redeploy."
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
  const { blobs } = await list({ prefix: BLOB_PATH });
  const match = blobs.find((blob) => blob.pathname === BLOB_PATH);
  if (!match) return { ...EMPTY };
  const response = await fetch(match.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Klarte ikke å lese grupper fra Blob (${response.status}).`);
  }
  return normalize(await response.json());
}

async function writeToBlob(data) {
  await put(BLOB_PATH, `${JSON.stringify(data, null, 2)}\n`, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true
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
