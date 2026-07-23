/**
 * Import class skills (+ runes/masteries) and talents from MetaForge.
 * Usage: node scripts/import-skills.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "data", "skills.json");
const META = "https://metaforge.app/farever/database/skills";
const ICON = "https://static.metaforge.app/farever/icons";

const CLASS_SKILL_KINDS = new Set(["Active", "Signature", "Passive", "Prayer", "Conduit"]);
const WEAPON_SKILL_KINDS = new Set(["Weapon Skill", "Weapon Passive"]);
const TALENT_KIND = "Talent";

function materialize(pool, index, seen = new Map()) {
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
  if (!node || typeof node !== "object") {
    return null;
  }
  if (node.type === "data" && Array.isArray(node.data)) {
    return materialize(node.data, 0);
  }
  return null;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`${url} → ${response.status}`);
  }
  return response.json();
}

function decodePayload(payload) {
  const decoded = [];
  for (const node of payload.nodes || []) {
    const value = decodeNodeData(node);
    if (value) {
      decoded.push(value);
    }
  }
  return decoded;
}

async function listAllSkills() {
  const first = await fetchJson(`${META}/page/1/__data.json`);
  const pageNode = decodePayload(first).find((node) => Array.isArray(node.items));
  if (!pageNode) {
    throw new Error("Could not find skills list page payload");
  }

  const totalPages = Number(pageNode.pagination?.totalPages) || 1;
  const items = [...pageNode.items];

  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await fetchJson(`${META}/page/${page}/__data.json`);
    const node = decodePayload(payload).find((entry) => Array.isArray(entry.items));
    if (node?.items?.length) {
      items.push(...node.items);
    }
    console.log(`  list page ${page}/${totalPages} (+${node?.items?.length ?? 0})`);
  }

  return items;
}

async function fetchSkillDetail(slug) {
  const payload = await fetchJson(`${META}/${slug}/__data.json`);
  for (const node of decodePayload(payload)) {
    if (node?.entry?.slug || node?.entry?.name) {
      return node.entry;
    }
  }
  return null;
}

function normalizeRune(rune) {
  if (!rune) {
    return null;
  }
  return {
    id: rune.id || rune.name_raw || rune.slug || rune.name,
    name: rune.name || rune.id,
    slug: rune.slug || "",
    rank: Number(rune.rank) || 0,
    rankLabel: rune.rank_label || "",
    description: rune.description || "",
    iconFilename: rune.icon_filename || "",
    iconUrl: rune.icon_filename ? `${ICON}/${rune.icon_filename}` : "",
    parentSkillSlug: rune.parent_skill_slug || "",
    rarity: rune.rarity || ""
  };
}

function inferMaxRank(entry) {
  const ranks = Array.isArray(entry.rank_descriptions) ? entry.rank_descriptions.filter(Boolean) : [];
  if (ranks.length > 0) {
    return ranks.length;
  }
  // EA talent nodes are almost all 1–2 ranks; default 2 keeps planner flexible.
  return entry.subcategory === TALENT_KIND ? 2 : 1;
}

function normalizeSkill(entry, listItem) {
  const runesSource = Array.isArray(entry.masteries) && entry.masteries.length
    ? entry.masteries
    : Array.isArray(entry.runes)
      ? entry.runes
      : [];

  const kind = entry.subcategory || listItem.subcategory || "";
  const grantedByItems = Array.isArray(entry.granted_by_items) ? entry.granted_by_items : [];
  const weaponSubcategories = [
    ...new Set(
      grantedByItems
        .map((item) => item?.subcategory)
        .filter((value) => typeof value === "string" && value.trim())
    )
  ].sort((left, right) => left.localeCompare(right));

  return {
    id: entry.name_raw || entry.id || listItem.name_raw || listItem.slug,
    metaforgeId: entry.id ?? listItem.id ?? null,
    name: entry.name || listItem.name,
    slug: entry.slug || listItem.slug,
    kind,
    classes: Array.isArray(entry.classes) ? entry.classes : listItem.classes || [],
    description: entry.description || "",
    cooldown: entry.cooldown ?? null,
    duration: entry.duration ?? null,
    iconFilename: entry.icon_filename || listItem.icon_filename || "",
    iconUrl: (entry.icon_filename || listItem.icon_filename)
      ? `${ICON}/${entry.icon_filename || listItem.icon_filename}`
      : "",
    maxRank: inferMaxRank(entry),
    runes: runesSource.map(normalizeRune).filter(Boolean),
    weaponSubcategories,
    grantedByItems: grantedByItems.map((item) => ({
      itemId: item.item_id ?? null,
      itemName: item.item_name || "",
      subcategory: item.subcategory || "",
      rarity: item.rarity || "",
      unlockTier: item.unlock_tier ?? null
    })),
    pageUrl: `https://metaforge.app/farever/database/skills/${entry.slug || listItem.slug}`
  };
}

function wantedListItem(item) {
  const kind = item.subcategory;
  return kind === TALENT_KIND || CLASS_SKILL_KINDS.has(kind) || WEAPON_SKILL_KINDS.has(kind);
}

async function main() {
  console.log("Listing MetaForge skills…");
  const listItems = await listAllSkills();
  const wanted = listItems.filter(wantedListItem);
  console.log(`Detail-fetching ${wanted.length} class/weapon skills/talents…`);

  const skills = [];
  let index = 0;
  for (const item of wanted) {
    index += 1;
    try {
      const entry = await fetchSkillDetail(item.slug);
      if (!entry) {
        console.warn(`  skip ${item.slug} (no detail)`);
        continue;
      }
      skills.push(normalizeSkill(entry, item));
      if (index % 20 === 0 || index === wanted.length) {
        console.log(`  ${index}/${wanted.length}`);
      }
    } catch (error) {
      console.warn(`  fail ${item.slug}: ${error.message}`);
    }
  }

  skills.sort((left, right) => {
    const classDelta = String(left.classes[0] || "").localeCompare(String(right.classes[0] || ""));
    if (classDelta !== 0) {
      return classDelta;
    }
    const kindDelta = String(left.kind).localeCompare(String(right.kind));
    if (kindDelta !== 0) {
      return kindDelta;
    }
    return String(left.name).localeCompare(String(right.name));
  });

  const payload = {
    source: META,
    importedAt: new Date().toISOString(),
    talentPointsAtLevel25: 17,
    total: skills.length,
    skills
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${skills.length} skills → ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
