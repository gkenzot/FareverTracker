/**
 * Set weapons/armor catalog itemLevel to the max obtainable level.
 * Usage: node scripts/patch-gear-catalog-levels.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolveMaxObtainableCatalogLevel } from "./gear-catalog-levels.mjs";

const WEAPONS_PATH = new URL("../public/data/weapons.json", import.meta.url);
const ARMOR_PATH = new URL("../public/data/armor.json", import.meta.url);

function applyLevel(item, nextLevel) {
  item.itemLevel = nextLevel;
  if (item.properties && typeof item.properties === "object") {
    item.properties.level = nextLevel;
  }
}

async function patchFile(path, collectionKey) {
  const data = JSON.parse(await readFile(path, "utf8"));
  const items = data[collectionKey] ?? [];
  let changed = 0;
  const samples = [];

  for (const item of items) {
    const next = resolveMaxObtainableCatalogLevel(item);
    if (next == null) {
      continue;
    }
    const prev = item.itemLevel ?? item.properties?.level ?? null;
    if (Number(prev) === Number(next)) {
      continue;
    }
    applyLevel(item, next);
    changed += 1;
    if (samples.length < 20) {
      samples.push(`${item.name}: ${prev} → ${next}`);
    }
  }

  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return { changed, total: items.length, samples };
}

async function main() {
  const weapons = await patchFile(WEAPONS_PATH, "weapons");
  const armor = await patchFile(ARMOR_PATH, "armor");
  console.log(`weapons: ${weapons.changed}/${weapons.total} updated`);
  for (const line of weapons.samples) console.log("  ", line);
  console.log(`armor: ${armor.changed}/${armor.total} updated`);
  for (const line of armor.samples) console.log("  ", line);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
