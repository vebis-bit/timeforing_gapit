import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Gruppene lagres i data/groups.json. I Docker monteres data/ som et volum, så
// fila overlever omstart og nye bygg. Dette er appens eneste datalager.
const DATA_DIR = path.join(process.cwd(), "data");
const GROUPS_FILE = path.join(DATA_DIR, "groups.json");

const EMPTY = { groups: [] };

// Rydder rådata til en trygg, forutsigbar form:
//  - hver gruppe får { id, name, memberIds: string[], captainId: string|null }
//  - en ansatt kan bare stå i ÉN gruppe (første gruppe vinner ved kollisjon)
//  - captainId nulles hvis personen ikke (lenger) er medlem
// Kjøres både ved lesing og skriving, så fila på disk alltid er normalisert.
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

// Les gruppene fra disk. Mangler fila (første kjøring / tomt volum) => { groups: [] }.
export async function readGroups() {
  try {
    const text = await readFile(GROUPS_FILE, "utf8");
    return normalize(JSON.parse(text));
  } catch (error) {
    if (error.code === "ENOENT") return { ...EMPTY };
    throw error;
  }
}

// Normaliser og skriv gruppene til disk (pretty-printet JSON). Returnerer det
// normaliserte objektet som ble lagret.
export async function writeGroups(raw) {
  const data = normalize(raw);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(GROUPS_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return data;
}
