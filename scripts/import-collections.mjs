import { access, mkdir, writeFile } from "node:fs/promises";

const META_FORGE_DATABASE_URL = "https://metaforge.app/farever/database";
const ICON_BASE_URL = "https://static.metaforge.app/farever/icons";
const FORCE_DOWNLOAD = process.argv.includes("--force-images");
const PREFERRED_PROPERTY_KEYS = [
  "species",
  "variant",
  "subcategory",
  "family",
  "type",
  "classes",
  "rarity",
  "level",
  "ilevel",
  "colour",
  "weapon_damage",
  "pickup_rarity",
  "produces_name"
];
const KNOWN_SOURCE_KEYS = new Set([
  "affinity",
  "affinity_color",
  "augment_targets",
  "classes",
  "availability_note",
  "colour",
  "completable",
  "description",
  "effects",
  "faction",
  "family",
  "flags",
  "flavor_desc",
  "gain_item",
  "icon_filename",
  "id",
  "ilevel",
  "is_templated",
  "level",
  "material_subtype",
  "max_level",
  "model_path",
  "mount_info",
  "moveset",
  "name",
  "name_raw",
  "pickup_item_id",
  "pickup_rarity",
  "produces",
  "produces_name",
  "rarity",
  "rarity_color",
  "sell_back_price",
  "sell_price",
  "sell_price_base",
  "sell_price_display",
  "slot",
  "slug",
  "stack_size",
  "subcategory",
  "tab",
  "tool_job",
  "type",
  "weapon_damage"
]);
const HIDDEN_PROPERTY_KEYS = new Set([
  "availability_note",
  "description",
  "effects",
  "faction",
  "flags",
  "flavor_desc",
  "icon_filename",
  "id",
  "model_path",
  "moveset",
  "name",
  "name_raw",
  "pickup_item_id",
  "produces",
  "rarity_color",
  "slug",
  "tab"
]);
const PROPERTY_FIELD_LABELS = {
  species: "Species",
  variant: "Variant",
  subcategory: "Subcategory",
  family: "Family",
  type: "Type",
  classes: "Classes",
  rarity: "Rarity",
  level: "Level",
  ilevel: "Item Level",
  colour: "Colour",
  weapon_damage: "Weapon Damage",
  pickup_rarity: "Pickup Rarity",
  produces_name: "Produces"
};
const COMPANION_SPECIES_PREFIXES = [
  "YellowRabbits",
  "DemonDog",
  "StinkBug",
  "Ladybug",
  "Squirrel",
  "Rabbit",
  "Sheep",
  "Turtle",
  "Lizard",
  "Frog",
  "Goat"
];

const DUNGEON_ARMOR_SOURCES = {
  RManfish: [
    "Lost City of Mayda",
    "Crabgantua's Gorge",
    "Abyss of New Atlaan"
  ],
  RKobold: [
    "Mine Estrone",
    "Ratsar's Lair",
    "Ruins of Gorgon's Hollow",
    "Cheese Station"
  ],
  RBee: [
    "Trunk of the Hivetree",
    "Lady Bee's Palace",
    "Honeyzabeth's Hivetrunk"
  ]
};
const ARMOR_FACTION_LABELS = {
  RManfish: "Manfish",
  RKobold: "Kobold",
  RBee: "Bee",
  RDemon: "Demon",
  RCrimson: "Crimson"
};
const WEAPON_BOSS_DUNGEONS = {
  "Munster Chuck": "Cheese Station",
  Reblochonk: "Cheese Station",
  "King Ratsar": "Ratsar's Lair",
  Golcano: "Ruins of Gorgon's Hollow",
  "Lady Bee": "Lady Bee's Palace",
  Gatsbee: "Lady Bee's Palace",
  "Queen Honeyzabeth": "Honeyzabeth's Hivetrunk",
  Crabgantua: "Crabgantua's Gorge",
  Nepsilon: "Abyss of New Atlaan",
  "Sponge Blob": "Lost City of Mayda",
  "High Inquisitor Chakram": "Chakram's Chapel",
  "Robin Hoof": "Crimson Barracks"
};
const JEWELLERY_SOURCE_OVERRIDES = {
  Poetrident: { kind: "drop", text: "Dungeon Manfish", link: null },
  "Raclette Pan": { kind: "drop", text: "Dungeon Kobold", link: null },
  "Eternal Flower Heart": { kind: "drop", text: "Dungeon Bee", link: null },
  "Lost Relic Found": { kind: "drop", text: "Dungeon Crimson", link: null }
};
const CRIMSON_ARMOR_NOTE = "Dungeon Crimson";
const VALLEY_LEVEL_20_SHOP_WEAPONS = new Set([
  "Radiance",
  "Judgement",
  "Judgment",
  "Credence",
  "Glory",
  "Dominion",
  "Apprentice's Grimoire",
  "Light Practice Sword",
  "Practice Daggers",
  "Training Buckler",
  "Initiate's Scepter"
]);
const UNAVAILABLE_NOTE = "Not available in the current version.";
const MOUNT_GLIDER_UNAVAILABLE = new Set([
  "Alandian Leggybug",
  "Antelimbian Dragoon",
  "Antelimbian Hound",
  "Antelimbian Leggybug",
  "Antelimbian Moth",
  "Atlanese Crocoboar",
  "Beltirian Crocoboar",
  "Crimson Crab",
  "Egheretrian Crocoboar",
  "Egheretrian Featherbeak",
  "Eksodean Crocoboar",
  "Eksodean Featherbeak",
  "Enripian Featherbeak",
  "Irukalean Hog",
  "Jodarian Hog",
  "Lemian Hound",
  "Meropsian Dragoon",
  "Meropsian Featherbeak",
  "Navelian Featherbeak",
  "Niflelian Bat",
  "Niflelian Crab",
  "Niflelian Crocoboar",
  "Niflelian Dragoon",
  "Niflelian Goat",
  "Niflelian Hog",
  "Niflelian Leggybug",
  "Niflelian Moth",
  "Niflelian Skunk",
  "Niflelian Wingfish",
  "Obralian Featherbeak",
  "Pink Moth",
  "Ponogian Crab",
  "Ruleanese Crocoboar",
  "Semeruian Seedbird",
  "Sforian Leggybug",
  "Skoverial Hound",
  "Skoverian Bat",
  "Skoverian Featherbeak",
  "Skoverian Seedbird",
  "Skoverian Wingfish",
  "Zerzurean Goat",
  "Zerzurian Crab"
]);
const MOUNT_GLIDER_SOURCE_OVERRIDES = {
  "Antelimbian Raccoon": {
    kind: "other",
    text: "Priest starter glider (granted at character creation).",
    link: null
  },
  "Antelimbian Seedbird": {
    kind: "chest",
    text: "Found in a chest at Crops Top.",
    link: null
  },
  "Azuramean Owl": {
    kind: "other",
    text: "Rogue starter glider (granted at character creation).",
    link: null
  },
  "Enripian Owl": {
    kind: "other",
    text: "Warrior starter glider (granted at character creation).",
    link: null
  },
  "Skoverial Raccoon": {
    kind: "other",
    text: "Mage starter glider (granted at character creation).",
    link: null
  }
};

const COLLECTIONS = [
  {
    key: "mounts",
    label: "mounts",
    sourceCategory: "mounts",
    outputData: "mounts.json",
    outputKey: "mounts",
    imageDir: "mounts",
    itemFilter: () => true,
    extraFields: (item) => ({
      moveSpeedMultiplier: item.mount_info?.move_speed_multiplier ?? item.props?.mount?.moveSpeedMultiplier ?? null
    })
  },
  {
    key: "gliders",
    label: "gliders",
    sourceCategory: "gliders",
    outputData: "gliders.json",
    outputKey: "gliders",
    imageDir: "gliders",
    itemFilter: () => true,
    extraFields: (item) => ({
      moveSpeedMultiplier: item.glider_info?.move_speed_multiplier ?? item.props?.glider?.moveSpeedMultiplier ?? null
    })
  },
  {
    key: "companions",
    label: "companions",
    sourceCategory: "creatures",
    outputData: "companions.json",
    outputKey: "companions",
    imageDir: "companions",
    itemFilter: (item) => item.subcategory === "Critter",
    extraFields: () => ({ moveSpeedMultiplier: null })
  },
  {
    key: "weapons",
    label: "weapons",
    sourceCategory: "weapons",
    outputData: "weapons.json",
    outputKey: "weapons",
    imageDir: "weapons",
    itemFilter: () => true,
    extraFields: () => ({ moveSpeedMultiplier: null })
  },
  {
    key: "armor",
    label: "armor",
    sourceCategory: "armor",
    outputData: "armor.json",
    outputKey: "armor",
    imageDir: "armor",
    itemFilter: () => true,
    extraFields: () => ({ moveSpeedMultiplier: null })
  },
  {
    key: "jewellery",
    label: "jewellery",
    sourceCategory: "jewellery",
    outputData: "jewellery.json",
    outputKey: "jewellery",
    imageDir: "jewellery",
    itemFilter: () => true,
    extraFields: () => ({ moveSpeedMultiplier: null })
  },
  {
    key: "recipes",
    label: "recipes",
    sourceCategory: "recipes",
    outputData: "recipes.json",
    outputKey: "recipes",
    imageDir: "recipes",
    itemFilter: () => true,
    extraFields: () => ({ moveSpeedMultiplier: null })
  }
];

function selectedCollections() {
  const requested = process.argv
    .filter((arg) => arg.startsWith("--only="))
    .flatMap((arg) => arg.replace("--only=", "").split(","))
    .map((arg) => arg.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    return COLLECTIONS;
  }

  return COLLECTIONS.filter((collection) => requested.includes(collection.key));
}

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
  if (!Array.isArray(node?.data)) {
    return node?.data ?? null;
  }

  return materialize(node.data, 0);
}

function findPageData(payload, collection) {
  if (payload.type === "redirect") {
    throw new Error(`MetaForge redirecionou ${collection.sourceCategory} para ${payload.location}`);
  }

  for (const node of payload.nodes ?? []) {
    const decoded = decodeNodeData(node);
    if (decoded?.items && decoded?.pagination) {
      return decoded;
    }
  }

  throw new Error(`Could not find items/pagination for ${collection.key}.`);
}

async function fetchPage(collection, page) {
  const url = `${META_FORGE_DATABASE_URL}/${collection.sourceCategory}/page/${page}/__data.json`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`MetaForge retornou ${response.status} para ${url}`);
  }

  const payload = await response.json();
  return findPageData(payload, collection);
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

async function fetchItemDetail(collection, slug) {
  const url = `${META_FORGE_DATABASE_URL}/${collection.sourceCategory}/${slug}/__data.json`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    console.warn(`Could not fetch detail for ${collection.key}/${slug}: ${response.status}`);
    return null;
  }

  const payload = await response.json();
  return findEntryData(payload);
}

function listItemNeedsDetail(item) {
  return !(
    item.obtained_from?.length ||
    item.dropped_by?.length ||
    item.shop_sources?.length ||
    item.reward_for_achievements?.length ||
    item.mount_info ||
    item.glider_info ||
    item.produces ||
    item.produces_name ||
    item.pickup_rarity
  );
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

const DETAIL_MERGE_KEYS = [
  "obtained_from",
  "dropped_by",
  "shop_sources",
  "reward_for_achievements",
  "chest_sources",
  "availability_note",
  "description",
  "flavor_desc",
  "mount_info",
  "glider_info",
  "produces",
  "produces_name",
  "pickup_rarity",
  "type",
  "subcategory",
  "classes",
  "rarity",
  "level",
  "ilevel",
  "slot",
  "icon_filename"
];

async function enrichRawItemsWithDetails(items, collection) {
  const missingItems = items.filter(listItemNeedsDetail);

  if (missingItems.length === 0) {
    return items;
  }

  console.log(`Fetching ${missingItems.length} ${collection.key} detail pages for source data...`);

  const detailsBySlug = new Map();
  let completed = 0;

  await mapWithConcurrency(missingItems, 10, async (item) => {
    const entry = await fetchItemDetail(collection, item.slug);
    if (entry) {
      detailsBySlug.set(item.slug, entry);
    }
    completed += 1;
    if (completed % 50 === 0 || completed === missingItems.length) {
      console.log(`  ${collection.key} details: ${completed}/${missingItems.length}`);
    }
  });

  return items.map((item) => {
    const detail = detailsBySlug.get(item.slug);
    if (!detail) {
      return item;
    }

    const merged = { ...item };
    for (const key of DETAIL_MERGE_KEYS) {
      if (detail[key] !== undefined && detail[key] !== null && detail[key] !== "") {
        merged[key] = detail[key];
      }
    }
    return merged;
  });
}

const RECIPE_LEARN_SOURCE_PRIORITY = ["shop", "world_drop", "drop", "auto_learn", "chest", "achievement"];
const RECIPE_WORLD_DROP_TEXT =
  "Recipe scroll drop from recipe chests, world crates, and humanoid enemies (profession-filtered pool).";

function normalizeRecipeSource(source) {
  const kind = source.kind ?? "unknown";
  const text = source.text ?? "";

  if (kind === "world_drop") {
    return {
      kind: "drop",
      text: text.includes("randomized pool") ? RECIPE_WORLD_DROP_TEXT : text,
      link: source.link ?? null
    };
  }

  if (kind === "auto_learn") {
    return {
      kind: "auto_learn",
      text: text.replace(/^Automatically known/, "Unlocked by default"),
      link: source.link ?? null
    };
  }

  if (kind === "shop") {
    return {
      kind: "shop",
      text: text
        .replace(/^Recipe learned from Recipe:\s*[^,]+,\s*/i, "")
        .replace(/^purchased from/i, "Purchased from"),
      link: source.link ?? null
    };
  }

  return {
    kind,
    text,
    link: source.link ?? null
  };
}

function summarizeRecipeSources(item) {
  const sources = (item.obtained_from ?? []).map(normalizeRecipeSource);
  const learnSources = sources
    .filter((source) => RECIPE_LEARN_SOURCE_PRIORITY.includes(source.kind))
    .sort(
      (sourceA, sourceB) =>
        RECIPE_LEARN_SOURCE_PRIORITY.indexOf(sourceA.kind) - RECIPE_LEARN_SOURCE_PRIORITY.indexOf(sourceB.kind)
    );
  const otherSources = sources.filter((source) => !RECIPE_LEARN_SOURCE_PRIORITY.includes(source.kind));

  if (learnSources.length > 0) {
    return [...learnSources, ...otherSources];
  }

  return sources.length > 0 ? sources : [{ kind: "unknown", text: "Source not mapped yet.", link: null }];
}

function summarizeSource(item) {
  const sources = item.obtained_from ?? [];

  if (sources.length > 0) {
    return prioritizeKnownSources(
      sources.map((source) => ({
        kind: source.kind ?? "unknown",
        text: source.text ?? "",
        link: source.link ?? null
      }))
    );
  }

  if (item.availability_note) {
    return [{ kind: "upcoming", text: item.availability_note, link: null }];
  }

  return [{ kind: "unknown", text: "Source not mapped yet.", link: null }];
}

function prioritizeKnownSources(sources) {
  const isWeakSource = (source) => source.kind === "unknown" || source.kind === "upcoming";

  return [...sources.filter((source) => !isWeakSource(source)), ...sources.filter(isWeakSource)];
}

function isUnknownSource(source) {
  return source.kind === "unknown" && source.text === "Source not mapped yet.";
}

function isGenericUpcoming(source) {
  return (
    source.kind === "upcoming" &&
    (source.text.includes("upcoming content") || source.text.includes("no information available"))
  );
}

function hasReliableSource(sources) {
  return sources.some((source) => !isUnknownSource(source) && !isGenericUpcoming(source));
}

function formatDropSource(drops) {
  const validDrops = (drops ?? []).filter((drop) => drop.unit_name);

  if (validDrops.length === 0) {
    return null;
  }

  const [firstDrop] = validDrops;
  const percent = firstDrop.drop_percent ?? `${(firstDrop.drop_probability * 100).toFixed(4).replace(/\.?0+$/, "")}%`;

  if (validDrops.length === 1) {
    return {
      kind: "drop",
      text: `${percent} chance to drop from ${firstDrop.unit_name}.`,
      link: null
    };
  }

  const names = validDrops.map((drop) => drop.unit_name).join(", ");
  return {
    kind: "drop",
    text: `${percent} chance to drop from ${names}.`,
    link: null
  };
}

function formatAchievementSource(achievements) {
  if (!achievements?.length) {
    return null;
  }

  const names = achievements.map((achievement) => achievement.name);

  if (names.length === 1) {
    return {
      kind: "achievement",
      text: `Reward from achievement: ${names[0]}.`,
      link: null
    };
  }

  return {
    kind: "achievement",
    text: `Reward from achievements: ${names.join(" / ")}.`,
    link: null
  };
}

function formatShopSource(shops) {
  if (!shops?.length) {
    return null;
  }

  const shop = shops[0];
  const npc = shop.npc_name ?? "vendor";
  const zone = shop.zone ? ` in ${shop.zone}` : "";

  return {
    kind: "shop",
    text: `Sold by ${npc}${zone}.`,
    link: null
  };
}

function deriveMountGliderSources(item) {
  return [formatDropSource(item.droppedBy), formatAchievementSource(item.achievements), formatShopSource(item.shops)].filter(
    Boolean
  );
}

function resolveMountGliderSources(item) {
  const override = MOUNT_GLIDER_SOURCE_OVERRIDES[item.name];

  if (override) {
    return [override];
  }

  if (hasReliableSource(item.sources)) {
    return item.sources.map((source) =>
      isGenericUpcoming(source) ? { kind: "upcoming", text: UNAVAILABLE_NOTE, link: null } : source
    );
  }

  const derived = deriveMountGliderSources(item);

  if (derived.length > 0) {
    return derived;
  }

  if (MOUNT_GLIDER_UNAVAILABLE.has(item.name)) {
    return [{ kind: "upcoming", text: UNAVAILABLE_NOTE, link: null }];
  }

  if (item.sources.some((source) => source.kind === "upcoming")) {
    return [{ kind: "upcoming", text: UNAVAILABLE_NOTE, link: null }];
  }

  return item.sources;
}

function enrichMountGliderItem(item) {
  const sources = resolveMountGliderSources(item);

  return {
    ...item,
    sources,
    inGame: sources[0]?.kind !== "upcoming"
  };
}


function withoutUnknownSources(sources) {
  return sources.filter((source) => !isUnknownSource(source));
}

function itemIdHasFaction(item, factionKey) {
  return item.id.includes(`_${factionKey}`) || item.id.includes(`${factionKey}_`);
}

function armorDungeonSource(item) {
  if (item.id.includes("_Craft")) {
    return null;
  }

  for (const [factionKey, dungeons] of Object.entries(DUNGEON_ARMOR_SOURCES)) {
    if (itemIdHasFaction(item, factionKey)) {
      const factionLabel = ARMOR_FACTION_LABELS[factionKey] ?? factionKey.replace(/^R/, "");
      return {
        source: {
          kind: "drop",
          text: `Dungeon ${factionLabel}`,
          link: null
        },
        dungeonSources: dungeons.map((dungeon) => ({
          dungeon,
          mode: "Normal/Hard",
          source: "Community dungeon loot"
        }))
      };
    }
  }

  if (itemIdHasFaction(item, "RCrimson")) {
    return {
      source: {
        kind: "drop",
        text: CRIMSON_ARMOR_NOTE,
        link: null
      },
      dungeonSources: []
    };
  }

  return null;
}

function valleyLevel20ShopSource(item) {
  if (!VALLEY_LEVEL_20_SHOP_WEAPONS.has(item.name)) {
    return null;
  }

  return {
    kind: "shop",
    text: "Sold by the Valley of Eternal Autumn merchant as a Rare Level 20 weapon.",
    link: null
  };
}

function withExtraSource(item, source) {
  const sources = withoutUnknownSources(item.sources);
  const exists = sources.some((existing) => existing.kind === source.kind && existing.text === source.text);

  return exists ? sources : [...sources, source];
}

function simplifyCraftText(text) {
  const match = String(text).match(/Crafted by\s+([A-Za-z]+)/i);
  return match ? `Craft by ${match[1]}` : text;
}

function simplifyWeaponDropText(text) {
  const match = String(text).match(/drop from\s+(.+?)\.?$/i);

  if (!match) {
    return text;
  }

  const boss = match[1].trim().replace(/\.$/, "");
  const dungeon = WEAPON_BOSS_DUNGEONS[boss];
  return dungeon ? `Dungeon ${dungeon}` : `Dungeon ${boss}`;
}

function simplifySourceText(source, collectionKey) {
  const kind = source.kind ?? "unknown";
  const text = source.text ?? "";
  const link = source.link ?? null;

  if (/Chaotic Gear Cache/i.test(text)) {
    return { kind, text: "Chaotic Gear Cache", link };
  }

  if (/Chaotic Weapon Cache/i.test(text)) {
    return { kind, text: "Chaotic Weapon Cache", link };
  }

  if (/Mysterious Cache/i.test(text)) {
    return { kind, text: "Mysterious Cache", link };
  }

  if (kind === "craft" || /^Crafted by\s+/i.test(text)) {
    return { kind: kind === "craft" ? "craft" : kind, text: simplifyCraftText(text), link };
  }

  if (kind === "starter" || /starter equipment/i.test(text)) {
    return { kind: "starter", text: "Starter", link };
  }

  if (kind === "instance") {
    if (/Crimson Barracks/i.test(text) && /Chakram/i.test(text)) {
      return { kind: "drop", text: "Dungeon Crimson Barracks / Chakram's Chapel", link };
    }

    if (/Crimson Barracks/i.test(text)) {
      return { kind: "drop", text: "Dungeon Crimson Barracks", link };
    }

    if (/Chakram/i.test(text)) {
      return { kind: "drop", text: "Dungeon Chakram's Chapel", link };
    }
  }

  if (kind === "drop" && collectionKey === "weapons") {
    return { kind, text: simplifyWeaponDropText(text), link };
  }

  if (kind === "drop" && collectionKey === "armor" && /Dungeon armor drop from/i.test(text)) {
    for (const [factionKey, dungeons] of Object.entries(DUNGEON_ARMOR_SOURCES)) {
      if (dungeons.some((dungeon) => text.includes(dungeon))) {
        return { kind, text: `Dungeon ${ARMOR_FACTION_LABELS[factionKey]}`, link };
      }
    }
  }

  if (collectionKey === "armor" && /Crimson faction armor/i.test(text)) {
    return { kind: "drop", text: "Dungeon Crimson", link };
  }

  if (kind === "shop" && /Valley of Eternal Autumn merchant/i.test(text)) {
    return { kind, text: "Valley merchant", link };
  }

  if (kind === "auto_learn") {
    const profession = text.match(/(Blacksmith|Outfitter|Cook|Jeweller|Alchemist|Enchanter)/i)?.[1];
    return { kind, text: profession ? `Default · ${profession}` : "Default", link };
  }

  if (kind === "world_event" && /Nightling Rifts/i.test(text)) {
    return { kind, text: "Nightling Rifts", link };
  }

  if (kind === "drop" && collectionKey === "recipes" && /recipe scroll drop|recipe drop/i.test(text)) {
    return { kind, text: "Drop", link };
  }

  if (kind === "shop" && /Zoey,\s*Demon Huntress|Shop · Zoey/i.test(text)) {
    return { kind, text: "Shop Zoey", link };
  }

  if ((kind === "unknown" || text === "Source not mapped yet.") && collectionKey === "jewellery") {
    return { kind: "drop", text: "Drop", link };
  }

  return { kind, text, link };
}

function dedupeSources(sources) {
  const seen = new Set();

  return sources.filter((source) => {
    const key = `${source.kind}::${source.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function simplifyItemSources(item, collection) {
  let sources = (item.sources ?? []).map((source) => simplifySourceText(source, collection.key));

  // Recipes: only keep how you learn them (drop / shop / default), not the craft recipe text.
  if (collection.key === "recipes") {
    const learnSources = sources.filter((source) => source.kind !== "craft");
    sources = learnSources.length > 0 ? learnSources : sources;
  }

  // Armor/weapons/jewellery: keep a single primary obtain method for How to get.
  if (collection.key === "armor" || collection.key === "weapons" || collection.key === "jewellery") {
    sources = sources.filter((source) => source.kind !== "auto_learn");
  }

  if (sources.length === 0 && collection.key === "jewellery") {
    sources = [{ kind: "drop", text: "Drop", link: null }];
  }

  return {
    ...item,
    sources: dedupeSources(sources)
  };
}

function enrichItem(item, collection) {
  if (collection.key === "jewellery") {
    const override = JEWELLERY_SOURCE_OVERRIDES[item.name];

    if (override) {
      return {
        ...item,
        sources: [override]
      };
    }
  }

  if (collection.key === "armor") {
    const dungeonSource = armorDungeonSource(item);

    if (dungeonSource) {
      const existingSources = withoutUnknownSources(item.sources).filter(
        (source) => source.kind !== dungeonSource.source.kind || source.text !== dungeonSource.source.text
      );

      return {
        ...item,
        sources: [dungeonSource.source, ...existingSources],
        dungeonSources: dungeonSource.dungeonSources
      };
    }
  }

  if (collection.key === "weapons") {
    const shopSource = valleyLevel20ShopSource(item);

    if (shopSource) {
      return {
        ...item,
        sources: withExtraSource(item, shopSource),
        shops: [
          ...item.shops,
          {
            npc_name: "Valley of Eternal Autumn merchant",
            zone: "Valley of Eternal Autumn",
            note: "Rare Level 20 weapon added in the 29/05/2026 patch notes."
          }
        ]
      };
    }
  }

  if (collection.key === "mounts" || collection.key === "gliders") {
    return enrichMountGliderItem(item);
  }

  return item;
}

function toWebpFilename(filename) {
  return filename ? filename.replace(/\.(png|jpg|jpeg)$/i, ".webp") : null;
}

function isPropertyValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((item) => ["string", "number", "boolean"].includes(typeof item));
  }

  return value !== null && value !== undefined && value !== "" && ["string", "number", "boolean"].includes(typeof value);
}

function isDisplayProperty(key, value) {
  if (!isPropertyValue(value) || HIDDEN_PROPERTY_KEYS.has(key)) {
    return false;
  }

  if (Array.isArray(value)) {
    return PREFERRED_PROPERTY_KEYS.includes(key);
  }

  return PREFERRED_PROPERTY_KEYS.includes(key) || !KNOWN_SOURCE_KEYS.has(key);
}

function sourceProperties(item) {
  return Object.fromEntries(Object.entries(item).filter(([key, value]) => isDisplayProperty(key, value)));
}

function formatCompanionVariant(variant) {
  return variant
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/(\D)(\d+)/g, "$1 $2")
    .trim();
}

function companionIdentity(nameRaw) {
  if (!nameRaw) {
    return { species: "Unknown", variant: "—" };
  }

  if (nameRaw === "YellowRabbits") {
    return { species: "Rabbit", variant: "Yellow" };
  }

  for (const species of COMPANION_SPECIES_PREFIXES) {
    if (nameRaw === species) {
      return { species, variant: "—" };
    }

    if (nameRaw.startsWith(`${species}_`)) {
      const variant = nameRaw.slice(species.length + 1);
      return { species, variant: formatCompanionVariant(variant) };
    }
  }

  const [species, ...rest] = nameRaw.split("_");
  return {
    species,
    variant: rest.length > 0 ? formatCompanionVariant(rest.join("_")) : "—"
  };
}

function jewellerySlotLabel(item) {
  const slot = item.slot ?? item.type ?? item.subcategory;

  if (slot === "GearFinger") {
    return "Finger";
  }

  if (slot === "GearNeck") {
    return "Neck";
  }

  if (slot === "GearTrinket") {
    return "Trinket";
  }

  return item.subcategory ?? item.type ?? "Other";
}

const CLASS_LABEL_ALIASES = {
  Fighter: "Warrior",
  Assassin: "Rogue",
  Wizard: "Mage",
  Cleric: "Priest"
};

function normalizeClassLabels(classes) {
  if (Array.isArray(classes)) {
    return [...new Set(classes.map((value) => CLASS_LABEL_ALIASES[value] ?? value))];
  }

  if (typeof classes === "string") {
    return CLASS_LABEL_ALIASES[classes] ?? classes;
  }

  return classes;
}

function normalizeProperties(item, collection) {
  const properties = sourceProperties(item);

  if (properties.classes !== undefined) {
    properties.classes = normalizeClassLabels(properties.classes);
  }

  if (collection.key === "jewellery") {
    const slot = jewellerySlotLabel(item);
    properties.subcategory = slot;
    properties.type = slot;
  }

  if (collection.key === "companions") {
    const { species, variant } = companionIdentity(item.name_raw ?? item.slug ?? String(item.id));
    properties.species = species;
    properties.variant = variant;
  }

  return properties;
}

function buildPropertyFields(items, getProperties = sourceProperties) {
  const keys = new Set();

  for (const item of items) {
    for (const key of Object.keys(getProperties(item))) {
      keys.add(key);
    }
  }

  return [...keys]
    .sort((keyA, keyB) => {
      const indexA = PREFERRED_PROPERTY_KEYS.indexOf(keyA);
      const indexB = PREFERRED_PROPERTY_KEYS.indexOf(keyB);

      if (indexA !== -1 || indexB !== -1) {
        return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) - (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
      }

      return keyA.localeCompare(keyB);
    })
    .map((key) => ({ key, label: PROPERTY_FIELD_LABELS[key] ?? key }));
}

function normalizeItem(item, collection) {
  const iconFilename = toWebpFilename(item.icon_filename ?? item.icon);
  const family =
    collection.key === "jewellery"
      ? jewellerySlotLabel(item)
      : collection.key === "companions"
        ? companionIdentity(item.name_raw ?? item.slug ?? String(item.id)).species
        : item.subcategory ?? item.type ?? "Outros";

  return {
    id: item.name_raw ?? item.slug ?? String(item.id),
    metaforgeId: item.id,
    name: item.name,
    slug: item.slug,
    family,
    rarity: item.rarity ?? "—",
    itemLevel: item.level ?? item.ilevel ?? null,
    description: item.description ?? item.flavor_desc ?? "",
    iconFilename,
    iconUrl: iconFilename ? `${ICON_BASE_URL}/${iconFilename}` : null,
    iconPath: iconFilename ? `/images/${collection.imageDir}/${iconFilename}` : null,
    pageUrl: `${META_FORGE_DATABASE_URL}/${collection.sourceCategory}/${item.slug}`,
    properties: normalizeProperties(item, collection),
    sources: collection.key === "recipes" ? summarizeRecipeSources(item) : summarizeSource(item),
    droppedBy: item.dropped_by ?? [],
    shops: item.shop_sources ?? [],
    achievements: item.reward_for_achievements ?? [],
    ...collection.extraFields(item)
  };
}

async function fileExists(fileUrl) {
  try {
    await access(fileUrl);
    return true;
  } catch {
    return false;
  }
}

async function downloadIcon(item, collection) {
  if (!item.iconFilename || !item.iconUrl) {
    return "skipped";
  }

  const imageDir = new URL(`../public/images/${collection.imageDir}/`, import.meta.url);
  const outputFile = new URL(item.iconFilename, imageDir);

  if (!FORCE_DOWNLOAD && (await fileExists(outputFile))) {
    return "exists";
  }

  const response = await fetch(item.iconUrl);
  if (!response.ok) {
    console.warn(`Could not download ${item.name}: ${response.status} ${item.iconUrl}`);
    return "failed";
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(imageDir, { recursive: true });
  await writeFile(outputFile, buffer);
  return "downloaded";
}

async function downloadIcons(items, collection) {
  await mkdir(new URL(`../public/images/${collection.imageDir}/`, import.meta.url), { recursive: true });

  const result = {
    downloaded: 0,
    exists: 0,
    skipped: 0,
    failed: 0
  };

  for (const item of items) {
    const status = await downloadIcon(item, collection);
    result[status] += 1;
  }

  return result;
}

async function importCollection(collection) {
  const firstPage = await fetchPage(collection, 1);
  const totalPages = firstPage.pagination?.totalPages ?? 1;
  const pages = [firstPage];

  for (let page = 2; page <= totalPages; page += 1) {
    pages.push(await fetchPage(collection, page));
  }

  const listedItems = pages.flatMap((page) => page.items ?? []).filter(collection.itemFilter);
  const rawItems = await enrichRawItemsWithDetails(listedItems, collection);
  const items = rawItems
    .map((item) => normalizeItem(item, collection))
    .map((item) => enrichItem(item, collection))
    .map((item) => simplifyItemSources(item, collection))
    .sort((a, b) => a.name.localeCompare(b.name));
  const propertyFields = buildPropertyFields(items, (item) => item.properties);

  const iconResult = await downloadIcons(items, collection);
  const outputFile = new URL(`../public/data/${collection.outputData}`, import.meta.url);
  const payload = {
    source: `${META_FORGE_DATABASE_URL}/${collection.sourceCategory}`,
    importedAt: new Date().toISOString(),
    total: items.length,
    propertyFields,
    [collection.outputKey]: items
  };

  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Imported ${items.length} ${collection.label} to ${outputFile.pathname}`);
  console.log(
    `Icons ${collection.key}: ${iconResult.downloaded} downloaded, ${iconResult.exists} existing, ${iconResult.failed} failed.`
  );
}

async function main() {
  for (const collection of selectedCollections()) {
    await importCollection(collection);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
