/**
 * One-shot / reusable patch: MetaForge often stores Demon armor as level 1
 * and omits levels on dungeon armor (especially Chest). Fill from faction defaults.
 *
 * Usage: node scripts/patch-armor-levels.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const ARMOR_PATH = new URL("../public/data/armor.json", import.meta.url);

export const ARMOR_FACTION_BASE_LEVELS = {
  RManfish: 25,
  RKobold: 25,
  RBee: 25,
  RCrimson: 25,
  RDemon: 25
};

export function armorFactionKey(itemId) {
  const id = String(itemId ?? "");
  for (const key of Object.keys(ARMOR_FACTION_BASE_LEVELS)) {
    if (id.includes(`_${key}`) || id.includes(`${key}_`)) {
      return key;
    }
  }
  return null;
}

function isStarterArmor(item) {
  const id = String(item?.id ?? "");
  if (/_Start$/i.test(id) || /_Starter_/i.test(id) || /^Starter_/i.test(id)) {
    return true;
  }
  const sources = Array.isArray(item?.sources) ? item.sources : [];
  return sources.some((source) => String(source?.kind ?? "").toLowerCase() === "starter");
}

/** Resolve catalog level for armor; returns null when unchanged / unknown. */
export function resolveArmorCatalogLevel(item) {
  if (!item || isStarterArmor(item)) {
    return null;
  }

  const faction = armorFactionKey(item.id);
  const factionLevel = faction ? ARMOR_FACTION_BASE_LEVELS[faction] : null;
  if (factionLevel == null) {
    return null;
  }

  const raw = item.itemLevel ?? item.properties?.level ?? item.properties?.ilevel;
  if (raw == null || raw === "") {
    return factionLevel;
  }

  const number = Number(raw);
  if (number === 1) {
    return factionLevel;
  }

  return null;
}

async function main() {
  const data = JSON.parse(await readFile(ARMOR_PATH, "utf8"));
  let changed = 0;
  const samples = [];

  for (const item of data.armor ?? []) {
    const next = resolveArmorCatalogLevel(item);
    if (next == null) {
      continue;
    }

    const prev = item.itemLevel ?? null;
    item.itemLevel = next;
    if (item.properties && typeof item.properties === "object") {
      item.properties.level = next;
    }
    changed += 1;
    if (samples.length < 25) {
      samples.push({
        name: item.name,
        from: prev,
        to: next,
        sub: item.properties?.subcategory ?? null
      });
    }
  }

  await writeFile(ARMOR_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Patched ${changed} armor item levels.`);
  console.log(samples);

  for (const name of [
    "Mask of the Unbidden Imp",
    "Demon Hunter's Mantle",
    "Brutality Faceshield",
    "Breastplate of Recklessness",
    "Abyssal Shoulderplates",
    "Belt of Sacrifice",
    "Apprentice's Tunic"
  ]) {
    const item = data.armor.find((entry) => entry.name === name);
    if (item) {
      console.log(`${item.name}: ${item.itemLevel}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
