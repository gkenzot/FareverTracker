/**
 * Enrich weapons/armor/jewellery with combat stats and import augments.
 *
 * Gear stats prefer SiagartaDB fixed values (match in-game tooltips).
 * Fallback: MetaForge detail stats (per-class for armor).
 * Augments come from MetaForge (gems / enchantments / plates).
 *
 * Usage:
 *   node scripts/enrich-gear-stats.mjs
 *   node scripts/enrich-gear-stats.mjs --only=jewellery,augments
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";

const META_FORGE_DATABASE_URL = "https://metaforge.app/farever/database";
const SIAGARTA_ITEM_URL = "https://siagartadb.info/en/items";
const ICON_BASE_URL = "https://static.metaforge.app/farever/icons";
const FORCE_DOWNLOAD = process.argv.includes("--force-images");

const HERO_CLASS_SOURCES = new Set([
  "Warrior",
  "Rogue",
  "Mage",
  "Priest",
  "Fighter",
  "Assassin",
  "Wizard",
  "Cleric"
]);

const CLASS_LABEL_ALIASES = {
  Fighter: "Warrior",
  Assassin: "Rogue",
  Wizard: "Mage",
  Cleric: "Priest"
};

function selectedKeys() {
  const requested = process.argv
    .filter((arg) => arg.startsWith("--only="))
    .flatMap((arg) => arg.replace("--only=", "").split(","))
    .map((arg) => arg.trim())
    .filter(Boolean);

  return requested.length > 0 ? new Set(requested) : null;
}

function materialize(pool, index, seen = new Map()) {
  if (typeof index !== "number") {
    return index;
  }

  const value = pool[index];
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(index)) {
    return seen.get(index);
  }

  if (Array.isArray(value)) {
    const array = [];
    seen.set(index, array);
    for (const itemIndex of value) {
      array.push(typeof itemIndex === "number" ? materialize(pool, itemIndex, seen) : itemIndex);
    }
    return array;
  }

  const object = {};
  seen.set(index, object);
  for (const [key, itemIndex] of Object.entries(value)) {
    object[key] = typeof itemIndex === "number" ? materialize(pool, itemIndex, seen) : itemIndex;
  }
  return object;
}

function decodeNodeData(node) {
  if (!Array.isArray(node?.data)) {
    return node?.data ?? null;
  }

  return materialize(node.data, 0);
}

function findEntryData(payload) {
  for (const node of payload.nodes ?? []) {
    const decoded = decodeNodeData(node);
    if (decoded?.entry) {
      return decoded.entry;
    }
  }
  return null;
}

function findPageData(payload) {
  for (const node of payload.nodes ?? []) {
    const decoded = decodeNodeData(node);
    if (decoded?.items && decoded?.pagination) {
      return decoded;
    }
  }
  return null;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function parseStatNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (value && typeof value === "object" && Number.isFinite(Number(value.val))) {
    return Math.round(Number(value.val));
  }
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return match ? Math.round(Number(match[0])) : 0;
}

function mapFlatStats(entries) {
  return (entries ?? [])
    .map((entry) => ({
      label: String(entry.label ?? "").trim(),
      value: parseStatNumber(entry.raw ?? entry.value)
    }))
    .filter((entry) => entry.label && Number.isFinite(entry.value));
}

function groupScaledStatsByClass(statsScaled) {
  const byClass = {};
  for (const entry of statsScaled ?? []) {
    const source = CLASS_LABEL_ALIASES[entry.source] ?? entry.source ?? "Default";
    if (!byClass[source]) {
      byClass[source] = [];
    }
    byClass[source].push({
      label: String(entry.label ?? "").trim(),
      value: parseStatNumber(entry.raw ?? entry.value)
    });
  }
  return byClass;
}

/** MetaForge weapon_damage blob → catalog field used by Build Lab damage. */
function normalizeWeaponDamage(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const avg = Number(raw.avg);
  if (!Number.isFinite(avg)) {
    return null;
  }

  return {
    min: Number(raw.min) || 0,
    max: Number(raw.max) || 0,
    avg,
    affinity: raw.affinity ?? null,
    skillId: raw.skill_id ?? null,
    scalingAttr: raw.scaling_attr ?? null,
    scalingRatio: Number(raw.scaling_ratio) || 0,
    note: raw._note ?? null
  };
}

function statsFromMetaforgeEntry(entry) {
  if (entry?.stats_display?.length) {
    return {
      stats: mapFlatStats(entry.stats_display),
      statsByClass: null,
      statsSource: "metaforge"
    };
  }

  if (!entry?.stats_scaled?.length) {
    return { stats: [], statsByClass: null, statsSource: null };
  }

  const byClass = groupScaledStatsByClass(entry.stats_scaled);
  const sources = Object.keys(byClass);
  const isHeroSplit = sources.some((source) => HERO_CLASS_SOURCES.has(source));

  if (isHeroSplit) {
    return {
      stats: [],
      statsByClass: byClass,
      statsSource: "metaforge"
    };
  }

  // Multi-rating jewellery/etc.: keep unique labels (max). Prefer Siagarta when available.
  const unique = new Map();
  for (const entryStat of entry.stats_scaled) {
    const label = String(entryStat.label ?? "").trim();
    const value = parseStatNumber(entryStat.raw ?? entryStat.value);
    if (!label) {
      continue;
    }
    unique.set(label, Math.max(unique.get(label) ?? 0, value));
  }

  return {
    stats: [...unique.entries()].map(([label, value]) => ({ label, value })),
    statsByClass: null,
    statsSource: "metaforge"
  };
}

function extractSiagartaStatsScale(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)].map((match) => {
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return "";
    }
  });
  const joined = chunks.join("");
  const marker = '"payload":{';
  const start = joined.indexOf(marker);
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let end = -1;
  const objectStart = joined.indexOf("{", start);
  for (let index = objectStart; index < joined.length; index += 1) {
    const char = joined[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  if (end < 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(joined.slice(objectStart, end).replace(/"\$undefined"/g, "null"));
    if (!parsed?.baseApts || !parsed?.scalings) {
      return null;
    }
    return {
      rarity: parsed.rarity ?? null,
      baseApts: parsed.baseApts,
      atbRatio: parsed.atbRatio ?? null,
      scalings: parsed.scalings,
      faction: parsed.faction ?? null,
      flawless: Boolean(parsed.flawless),
      upgradeLevel: Number(parsed.upgradeLevel) || 0
    };
  } catch {
    return null;
  }
}

function extractSiagartaFixedStats(html) {
  const rows = [
    ...html.matchAll(
      /color:var\(--color-ink\)">([^<]+)<\/td><td class="border-b py-2\.5 text-right tabular-nums"[^>]*color:var\(--color-ink\)">(\d+(?:\.\d+)?)</g
    )
  ];

  return rows.map((match) => ({
    label: match[1].trim(),
    value: Math.round(Number(match[2]))
  }));
}

async function fetchSiagartaGearData(itemId) {
  const response = await fetch(`${SIAGARTA_ITEM_URL}/${encodeURIComponent(itemId)}`, {
    headers: { accept: "text/html" }
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  return {
    stats: extractSiagartaFixedStats(html),
    statsScale: extractSiagartaStatsScale(html)
  };
}

async function fetchMetaforgeEntry(category, slug) {
  const url = `${META_FORGE_DATABASE_URL}/${category}/${slug}/__data.json`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    return null;
  }
  return findEntryData(await response.json());
}

async function fileExists(fileUrl) {
  try {
    await access(fileUrl);
    return true;
  } catch {
    return false;
  }
}

function toWebpFilename(filename) {
  if (!filename) {
    return null;
  }
  return String(filename).replace(/\.(png|jpg|jpeg|webp)$/i, ".webp");
}

async function downloadIcon(item, imageDirName) {
  if (!item.iconFilename || !item.iconUrl) {
    return "skipped";
  }

  const imageDir = new URL(`../public/images/${imageDirName}/`, import.meta.url);
  const outputFile = new URL(item.iconFilename, imageDir);

  if (!FORCE_DOWNLOAD && (await fileExists(outputFile))) {
    return "exists";
  }

  const response = await fetch(item.iconUrl);
  if (!response.ok) {
    console.warn(`Could not download ${item.name}: ${response.status}`);
    return "failed";
  }

  await mkdir(imageDir, { recursive: true });
  await writeFile(outputFile, Buffer.from(await response.arrayBuffer()));
  return "downloaded";
}

async function enrichGearCollection(collectionKey) {
  const dataFile = new URL(`../public/data/${collectionKey}.json`, import.meta.url);
  const payload = JSON.parse(await readFile(dataFile, "utf8"));
  const items = payload[collectionKey] ?? [];

  console.log(`Enriching ${items.length} ${collectionKey} with combat stats...`);

  let withSiagarta = 0;
  let withScale = 0;
  let withMetaforge = 0;
  let empty = 0;
  let completed = 0;

  let withWeaponDamage = 0;

  const enriched = await mapWithConcurrency(items, 8, async (item) => {
    let stats = [];
    let statsByClass = null;
    let statsSource = null;
    let statsScale = null;
    let metaforgeEntry = null;
    let weaponDamage = collectionKey === "weapons" ? item.weaponDamage ?? null : undefined;

    async function ensureMetaforgeEntry() {
      if (metaforgeEntry || !item.slug) {
        return metaforgeEntry;
      }
      metaforgeEntry = await fetchMetaforgeEntry(collectionKey, item.slug);
      return metaforgeEntry;
    }

    try {
      const sia = await fetchSiagartaGearData(item.id);
      if (sia?.statsScale) {
        statsScale = sia.statsScale;
        withScale += 1;
      }
      if (sia?.stats?.length) {
        stats = sia.stats;
        statsSource = "siagarta";
        withSiagarta += 1;
      }
    } catch {
      // fall through to MetaForge
    }

    if (!stats.length && item.slug) {
      const entry = await ensureMetaforgeEntry();
      const fromMf = statsFromMetaforgeEntry(entry);
      stats = fromMf.stats;
      statsByClass = fromMf.statsByClass;
      statsSource = fromMf.statsSource;
      if (stats.length || (statsByClass && Object.keys(statsByClass).length)) {
        withMetaforge += 1;
      } else {
        empty += 1;
      }
    } else if (!stats.length) {
      empty += 1;
    }

    if (collectionKey === "weapons" && item.slug) {
      const entry = await ensureMetaforgeEntry();
      const nextDamage = normalizeWeaponDamage(entry?.weapon_damage);
      if (nextDamage) {
        weaponDamage = nextDamage;
        withWeaponDamage += 1;
      }
    }

    completed += 1;
    if (completed % 40 === 0 || completed === items.length) {
      console.log(`  ${collectionKey}: ${completed}/${items.length}`);
    }

    const next = {
      ...item,
      stats,
      statsByClass,
      statsSource,
      statsScale
    };

    if (collectionKey === "weapons") {
      next.weaponDamage = weaponDamage ?? null;
      if (weaponDamage) {
        next.properties = {
          ...(item.properties ?? {}),
          weapon_damage: weaponDamage.avg
        };
      }
    }

    return next;
  });

  const withStarterScales =
    collectionKey === "weapons" ? applyStarterWeaponStatsScales(enriched) : enriched;
  const withArmorScales =
    collectionKey === "armor" ? applySynthesizedArmorStatsScales(withStarterScales) : withStarterScales;
  const withJewelleryScales =
    collectionKey === "jewellery"
      ? applySynthesizedTrinketStatsScales(withArmorScales)
      : withArmorScales;

  const nextPayload = {
    ...payload,
    importedAt: new Date().toISOString(),
    statsEnrichedAt: new Date().toISOString(),
    [collectionKey]: withJewelleryScales
  };

  if (collectionKey === "weapons") {
    const fields = Array.isArray(payload.propertyFields) ? [...payload.propertyFields] : [];
    if (!fields.some((field) => field.key === "weapon_damage")) {
      fields.push({ key: "weapon_damage", label: "Weapon Damage" });
    }
    nextPayload.propertyFields = fields;
  }

  await writeFile(dataFile, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");
  console.log(
    `Done ${collectionKey}: siagarta=${withSiagarta}, scale=${withScale}, metaforge=${withMetaforge}, empty=${empty}` +
      (collectionKey === "weapons" ? `, weaponDamage=${withWeaponDamage}` : "")
  );
}

/**
 * Starter / Valley shop weapons only expose flat L1 affixes on Siagarta.
 * In-game they use the normal gear curve with faction "Starter" (Crit or Pen by class).
 */
const STARTER_WEAPON_SCALE_REFS = {
  Sword_Start: { apt: "Fighter", refId: "GA_Craft", kind: "weapon" },
  Daggers_Start: { apt: "Assassin", refId: "Bow_Craft", kind: "weapon" },
  Book_Start: { apt: "Wizard", refId: "Staff_Craft", kind: "weapon" },
  Scepter_Start: { apt: "Cleric", refId: "Scepter_Flamie", kind: "weapon" },
  Shield_Start: { apt: "Fighter", refId: "Shield_Start", kind: "shield" }
};

function applyStarterWeaponStatsScales(items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  let patched = 0;

  for (const [id, config] of Object.entries(STARTER_WEAPON_SCALE_REFS)) {
    const item = byId.get(id);
    if (!item) {
      continue;
    }

    const ref = byId.get(config.refId);
    const aptScalings = ref?.statsScale?.scalings?.[config.apt];
    if (!Array.isArray(aptScalings) || !aptScalings.length) {
      continue;
    }

    const atbRatio =
      config.kind === "shield"
        ? { primary: null, vitality: null, ratings: null, armor: 0.337 }
        : { primary: 0.28, vitality: 0.26, ratings: 0.175, armor: null };

    item.statsScale = {
      rarity: "Rare",
      baseApts: [config.apt],
      atbRatio,
      scalings: { [config.apt]: structuredClone(aptScalings) },
      faction: "Starter",
      flawless: false,
      upgradeLevel: 0
    };
    item.rarity = "Rare";
    if (item.properties && typeof item.properties === "object") {
      item.properties.rarity = "Rare";
    }
    item.statsSource = item.statsSource || "siagarta-starter-scale";
    patched += 1;
  }

  if (patched) {
    console.log(`  Applied Starter faction statsScale to ${patched} starter weapons`);
  }

  return items;
}

/** Slot budget ratios observed on Siagarta-scaled armor pieces. */
const ARMOR_SLOT_ATB_RATIOS = {
  Head: { primary: 0.11, vitality: 0.09, ratings: 0.075, armor: 0.14 },
  Shoulders: { primary: 0.08, vitality: 0.07, ratings: 0.055, armor: 0.13 },
  Chest: { primary: 0.11, vitality: 0.09, ratings: 0.075, armor: 0.18 },
  Back: { primary: 0.07, vitality: 0.05, ratings: 0.04, armor: 0.05 },
  Hands: { primary: 0.08, vitality: 0.065, ratings: 0.055, armor: 0.11 },
  Waist: { primary: 0.08, vitality: 0.065, ratings: 0.055, armor: 0.11 },
  Legs: { primary: 0.11, vitality: 0.09, ratings: 0.075, armor: 0.16 },
  Feet: { primary: 0.08, vitality: 0.07, ratings: 0.055, armor: 0.12 }
};

const CLASS_TO_APTITUDE = {
  Warrior: "Fighter",
  Fighter: "Fighter",
  Rogue: "Assassin",
  Assassin: "Assassin",
  Mage: "Wizard",
  Wizard: "Wizard",
  Priest: "Cleric",
  Cleric: "Cleric"
};

function resolveArmorAptitudes(item) {
  const classes = item.properties?.classes;
  if (Array.isArray(classes) && classes.length) {
    const apts = [...new Set(classes.map((value) => CLASS_TO_APTITUDE[value]).filter(Boolean))];
    if (apts.length) {
      return apts;
    }
  }

  const id = String(item.id ?? "");
  const apts = [];
  if (/Fig/.test(id)) apts.push("Fighter");
  if (/Ass/.test(id)) apts.push("Assassin");
  if (/Wiz/.test(id)) apts.push("Wizard");
  if (/Cle/.test(id)) apts.push("Cleric");
  return [...new Set(apts)];
}

function resolveArmorFaction(item) {
  const id = String(item.id ?? "");
  if (id.includes("RDemon")) return "Demon";
  if (id.includes("RCrimson")) return "Crimson";
  if (id.includes("RBee")) return "Bee";
  if (id.includes("RKobold")) return "Kobold";
  if (id.includes("RManfish")) return "Manfish";
  if (/_Craft/i.test(id)) return "Craft";
  if (/Starter/i.test(id)) return "Starter";
  return "World";
}

/**
 * Many dungeon armor pages on Siagarta lack the interactive gear payload.
 * Fill missing statsScale from slot ratios + aptitude scalings + faction.
 */
function applySynthesizedArmorStatsScales(items) {
  const scalingsByApt = {};
  for (const item of items) {
    const scalings = item.statsScale?.scalings;
    if (!scalings) continue;
    for (const [apt, list] of Object.entries(scalings)) {
      if (!scalingsByApt[apt] && Array.isArray(list) && list.length) {
        scalingsByApt[apt] = list;
      }
    }
  }

  let patched = 0;
  for (const item of items) {
    if (item.statsScale?.scalings) {
      continue;
    }

    const slot = item.properties?.subcategory;
    const ratio = ARMOR_SLOT_ATB_RATIOS[slot];
    const apts = resolveArmorAptitudes(item);
    if (!ratio || !apts.length || !apts.every((apt) => scalingsByApt[apt])) {
      continue;
    }

    item.statsScale = {
      rarity: item.rarity || "Rare",
      baseApts: apts,
      atbRatio: { ...ratio },
      scalings: Object.fromEntries(apts.map((apt) => [apt, structuredClone(scalingsByApt[apt])])),
      faction: resolveArmorFaction(item),
      flawless: false,
      upgradeLevel: 0
    };
    item.statsSource = item.statsSource || "siagarta-armor-synth";
    patched += 1;
  }

  if (patched) {
    console.log(`  Synthesized statsScale for ${patched} armor pieces missing Siagarta payload`);
  }

  return items;
}

/** Match Finger/Lost Relic vitality budget (Siagarta Finger_Mp uses 0.05). */
const TRINKET_ATB_RATIO = { primary: 0, vitality: 0.05, ratings: 0.08, armor: null };

const JEWELLERY_CLASS_TO_APT = {
  ArPen: "ArPen",
  MaPen: "MaPen",
  Crit: "Crit",
  Fervor: "Fervor",
  Vita: "Vita"
};

function resolveTrinketAptitude(item) {
  const classes = item.properties?.classes;
  if (Array.isArray(classes)) {
    for (const value of classes) {
      if (JEWELLERY_CLASS_TO_APT[value]) {
        return JEWELLERY_CLASS_TO_APT[value];
      }
    }
  }

  const labels = (item.stats || []).map((stat) => String(stat.label));
  if (labels.includes("Armor Penetration")) return "ArPen";
  if (labels.includes("Magic Penetration")) return "MaPen";
  if (labels.includes("Critical")) return "Crit";
  if (labels.includes("Fervor")) return "Fervor";
  return null;
}

function resolveJewelleryFaction(item) {
  if (item.statsScale?.faction) {
    return item.statsScale.faction;
  }

  const id = String(item.id ?? "");
  const blob = [id, item.name, ...(item.sources || []).map((source) => source.text)]
    .filter(Boolean)
    .join(" ");

  if (/Demon|Nightling/i.test(blob)) return "Demon";
  if (/Crimson/i.test(blob)) return "Crimson";
  if (/Bee/i.test(blob)) return "Bee";
  if (/Kobold/i.test(blob)) return "Kobold";
  if (/Manfish/i.test(blob)) return "Manfish";
  return "World";
}

/**
 * Faction dungeon trinkets often lack Siagarta gear payload.
 * Use the same rating budget as Finger/Lost Relic (ratings 0.08).
 */
function applySynthesizedTrinketStatsScales(items) {
  const scalingsByApt = {};
  for (const item of items) {
    const scalings = item.statsScale?.scalings;
    if (!scalings) continue;
    for (const [apt, list] of Object.entries(scalings)) {
      if (!scalingsByApt[apt] && Array.isArray(list) && list.length) {
        scalingsByApt[apt] = list;
      }
    }
  }

  let patched = 0;
  for (const item of items) {
    const isTrinket = /trinket/i.test(item.properties?.subcategory || item.family || "");
    if (!isTrinket || item.statsScale?.scalings) {
      continue;
    }

    const apt = resolveTrinketAptitude(item);
    if (!apt || !scalingsByApt[apt]) {
      continue;
    }

    item.statsScale = {
      rarity: item.rarity || "Rare",
      baseApts: [apt],
      atbRatio: { ...TRINKET_ATB_RATIO },
      scalings: { [apt]: structuredClone(scalingsByApt[apt]) },
      faction: resolveJewelleryFaction(item),
      flawless: false,
      upgradeLevel: 0
    };
    item.statsSource = item.statsSource || "siagarta-trinket-synth";
    patched += 1;
  }

  if (patched) {
    console.log(`  Synthesized statsScale for ${patched} trinkets missing Siagarta payload`);
  }

  return items;
}

function adornmentKindFromSubcategory(subcategory) {
  const value = String(subcategory ?? "").toLowerCase();
  if (value.includes("demon sigil") || value.includes("demonic sigil")) {
    return "sigil";
  }
  if (value.includes("gem") || value.includes("cursed eye")) {
    return "stone";
  }
  if (value.includes("corrupted gift")) {
    return "corrupted";
  }
  if (value.includes("enchant")) {
    if (value.includes("hands") || value.includes("glove")) {
      return "enchantment-hands";
    }
    if (value.includes("feet") || value.includes("boot")) {
      return "enchantment-feet";
    }
    if (value.includes("weapon")) {
      return "enchantment-weapon";
    }
    if (value.includes("head") || value.includes("helmet") || value.includes("helm")) {
      return "sigil";
    }
    return "enchantment";
  }
  if (value.includes("embroider")) {
    return "embroidery";
  }
  if (value.includes("plate")) {
    return "plate";
  }
  return "other";
}

async function importAugments() {
  console.log("Importing augments from MetaForge...");

  const firstPayload = await (
    await fetch(`${META_FORGE_DATABASE_URL}/augments/page/1/__data.json`, {
      headers: { accept: "application/json" }
    })
  ).json();
  const firstPage = findPageData(firstPayload);
  if (!firstPage) {
    throw new Error("Could not load augments page 1");
  }

  const pages = [firstPage];
  const totalPages = firstPage.pagination?.totalPages ?? 1;
  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await (
      await fetch(`${META_FORGE_DATABASE_URL}/augments/page/${page}/__data.json`, {
        headers: { accept: "application/json" }
      })
    ).json();
    const pageData = findPageData(payload);
    if (pageData) {
      pages.push(pageData);
    }
  }

  const listed = pages.flatMap((page) => page.items ?? []);
  console.log(`Fetching details for ${listed.length} augments...`);

  let completed = 0;
  const detailed = await mapWithConcurrency(listed, 10, async (item) => {
    const entry = (await fetchMetaforgeEntry("augments", item.slug)) ?? item;
    completed += 1;
    if (completed % 25 === 0 || completed === listed.length) {
      console.log(`  augments details: ${completed}/${listed.length}`);
    }
    return entry;
  });

  const items = detailed
    .map((entry) => {
      const iconFilename = toWebpFilename(entry.icon_filename ?? entry.icon);
      const fromMf = statsFromMetaforgeEntry(entry);
      return {
        id: entry.name_raw ?? entry.slug ?? String(entry.id),
        metaforgeId: entry.id,
        name: entry.name,
        slug: entry.slug,
        family: entry.subcategory ?? entry.type ?? "Augment",
        rarity: entry.rarity ?? "—",
        itemLevel: entry.level ?? entry.ilevel ?? null,
        description: entry.description ?? entry.flavor_desc ?? "",
        iconFilename,
        iconUrl: iconFilename ? `${ICON_BASE_URL}/${iconFilename}` : null,
        iconPath: iconFilename ? `/images/augments/${iconFilename}` : null,
        pageUrl: `${META_FORGE_DATABASE_URL}/augments/${entry.slug}`,
        properties: {
          type: entry.type ?? entry.subcategory ?? null,
          subcategory: entry.subcategory ?? null,
          rarity: entry.rarity ?? null,
          level: entry.level ?? null
        },
        sources: [],
        droppedBy: entry.dropped_by ?? [],
        shops: entry.shop_sources ?? [],
        achievements: entry.reward_for_achievements ?? [],
        stats: fromMf.stats,
        statsByClass: null,
        statsSource: fromMf.statsSource,
        classes: Array.isArray(entry.classes) ? entry.classes : [],
        augmentTargets: entry.augment_targets ?? [],
        adornmentKind: adornmentKindFromSubcategory(entry.subcategory ?? entry.type)
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  let downloaded = 0;
  let exists = 0;
  let failed = 0;
  for (const item of items) {
    const status = await downloadIcon(item, "augments");
    if (status === "downloaded") downloaded += 1;
    if (status === "exists") exists += 1;
    if (status === "failed") failed += 1;
  }

  const outputFile = new URL("../public/data/augments.json", import.meta.url);
  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await writeFile(
    outputFile,
    `${JSON.stringify(
      {
        source: `${META_FORGE_DATABASE_URL}/augments`,
        importedAt: new Date().toISOString(),
        total: items.length,
        propertyFields: [
          { key: "subcategory", label: "Subcategory" },
          { key: "type", label: "Type" },
          { key: "rarity", label: "Rarity" },
          { key: "level", label: "Level" }
        ],
        augments: items
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`Imported ${items.length} augments (${downloaded} icons new, ${exists} existing, ${failed} failed)`);
}

async function main() {
  const only = selectedKeys();
  const should = (key) => !only || only.has(key);

  if (should("jewellery")) {
    await enrichGearCollection("jewellery");
  }
  if (should("weapons")) {
    await enrichGearCollection("weapons");
  }
  if (should("armor")) {
    await enrichGearCollection("armor");
  }
  if (should("augments")) {
    await importAugments();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
