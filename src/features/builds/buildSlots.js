import { CLASS_SKILL_MAX_ACTIVE, CLASS_SIGNATURE_SKILL_IDS, isLevel30Skill } from "./classSkillLoadout";
import { DEFAULT_BUILD, DEFAULT_BUILD_B } from "./damageFormulas";

function matchSubcategory(item, subcategory) {
  const value = item?.properties?.subcategory ?? item?.properties?.type ?? item?.family;
  return String(value ?? "").toLowerCase() === String(subcategory).toLowerCase();
}

export function getWeaponType(item) {
  return String(item?.properties?.subcategory ?? item?.properties?.type ?? item?.family ?? "").trim();
}

/**
 * Weapon types that occupy both Main Hand and Off Hand.
 * Dual/paired sets and classic two-handers.
 */
export const TWO_HANDED_WEAPON_TYPES = new Set([
  "GreatSword",
  "GreatAxe",
  "GreatMace",
  "DualSwords",
  "DualAxes",
  "DualMaces",
  "Daggers",
  "Fists",
  "Bow",
  "Staff",
  "Spear",
  "Halos",
  "Crescent"
]);

export function isTwoHandedWeapon(item) {
  if (!item) {
    return false;
  }

  return TWO_HANDED_WEAPON_TYPES.has(getWeaponType(item));
}

export function isOffHandOnlyWeapon(item) {
  return getWeaponType(item) === "Shield";
}

/** Layout columns matching the in-game equipment screen. */
export const EQUIPMENT_LAYOUT = {
  left: ["head", "pendant", "shoulders", "chest", "back", "ring1"],
  right: ["hands", "waist", "legs", "feet", "trinket", "ring2"],
  weapons: ["weapon", "secondaryWeapon", "arsenal"]
};

export const EQUIPMENT_SLOTS = [
  { key: "head", label: "Capacete", shortLabel: "Head", collectionKey: "armor", matches: (item) => matchSubcategory(item, "Head") },
  {
    key: "pendant",
    label: "Pendant",
    shortLabel: "Neck",
    collectionKey: "jewellery",
    matches: (item) => matchSubcategory(item, "Neck")
  },
  {
    key: "shoulders",
    label: "Ombro",
    shortLabel: "Shoulders",
    collectionKey: "armor",
    matches: (item) => matchSubcategory(item, "Shoulders")
  },
  { key: "chest", label: "Peito", shortLabel: "Chest", collectionKey: "armor", matches: (item) => matchSubcategory(item, "Chest") },
  { key: "back", label: "Capa", shortLabel: "Back", collectionKey: "armor", matches: (item) => matchSubcategory(item, "Back") },
  {
    key: "ring1",
    label: "Anel 1",
    shortLabel: "Ring",
    collectionKey: "jewellery",
    matches: (item) => matchSubcategory(item, "Finger")
  },
  { key: "hands", label: "Luva", shortLabel: "Hands", collectionKey: "armor", matches: (item) => matchSubcategory(item, "Hands") },
  { key: "waist", label: "Cinto", shortLabel: "Waist", collectionKey: "armor", matches: (item) => matchSubcategory(item, "Waist") },
  { key: "legs", label: "Calça", shortLabel: "Legs", collectionKey: "armor", matches: (item) => matchSubcategory(item, "Legs") },
  { key: "feet", label: "Bota", shortLabel: "Feet", collectionKey: "armor", matches: (item) => matchSubcategory(item, "Feet") },
  {
    key: "trinket",
    label: "Trinket",
    shortLabel: "Trinket",
    collectionKey: "jewellery",
    matches: (item) => matchSubcategory(item, "Trinket")
  },
  {
    key: "ring2",
    label: "Anel 2",
    shortLabel: "Ring",
    collectionKey: "jewellery",
    matches: (item) => matchSubcategory(item, "Finger")
  },
  { key: "weapon", label: "Main Hand", shortLabel: "Main", collectionKey: "weapons", matches: (item) => !isOffHandOnlyWeapon(item) },
  {
    key: "secondaryWeapon",
    label: "Off Hand",
    shortLabel: "Off",
    collectionKey: "weapons",
    matches: (item) => isOffHandOnlyWeapon(item)
  },
  {
    key: "arsenal",
    label: "Arsenal",
    shortLabel: "Arsenal",
    collectionKey: "weapons",
    // Weapons and shields; sheet stats use the arsenal “broken” factor.
    matches: (item) => Boolean(item)
  }
];

export const WEAPON_RARITY_OPTIONS = ["Rare", "Epic", "Legendary"];

/** Max weapon upgrade slots by rarity (Siagarta / game constants). */
export const RARITY_GEAR_UPGRADES = {
  Common: 0,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5
};

export function isWeaponEquipmentSlot(slotKey) {
  return slotKey === "weapon" || slotKey === "secondaryWeapon" || slotKey === "arsenal";
}

export function isArsenalEquipmentSlot(slotKey) {
  return slotKey === "arsenal";
}

export function isRingEquipmentSlot(slotKey) {
  return slotKey === "ring1" || slotKey === "ring2";
}

/** Rings can be equipped in both finger slots at once (separate adornments each). */
export function itemAllowsDuplicateEquip(item) {
  const type = String(item?.properties?.subcategory ?? item?.properties?.type ?? item?.family ?? "")
    .trim()
    .toLowerCase();
  return type === "finger" || type === "ring";
}

export function slotsAllowDuplicateItem(slotKeyA, slotKeyB, item) {
  if (isRingEquipmentSlot(slotKeyA) && isRingEquipmentSlot(slotKeyB) && itemAllowsDuplicateEquip(item)) {
    return true;
  }

  // Arsenal is a parallel slot: same weapon/shield id may also sit in Main or Off Hand.
  if (isArsenalEquipmentSlot(slotKeyA) || isArsenalEquipmentSlot(slotKeyB)) {
    const other = isArsenalEquipmentSlot(slotKeyA) ? slotKeyB : slotKeyA;
    return other === "weapon" || other === "secondaryWeapon" || other === "arsenal";
  }

  return false;
}

export function getItemCatalogRarity(item) {
  return String(item?.rarity ?? item?.properties?.rarity ?? "").trim();
}

/** Default rarity for a build slot: catalog value if Rare+, otherwise Rare. */
export function getDefaultUsedRarity(item) {
  const catalog = getItemCatalogRarity(item);
  const matched = WEAPON_RARITY_OPTIONS.find(
    (option) => option.toLowerCase() === catalog.toLowerCase()
  );
  return matched ?? "Rare";
}

export function resolveUsedRarity(slotValue, item) {
  const selected = String(slotValue?.usedRarity ?? "").trim();
  if (selected) {
    const matched = WEAPON_RARITY_OPTIONS.find(
      (option) => option.toLowerCase() === selected.toLowerCase()
    );
    if (matched) {
      return matched;
    }
  }
  return getDefaultUsedRarity(item);
}

export function getMaxWeaponUpgrades(rarity) {
  const key = String(rarity ?? "").trim();
  if (Object.prototype.hasOwnProperty.call(RARITY_GEAR_UPGRADES, key)) {
    return RARITY_GEAR_UPGRADES[key];
  }
  const matched = Object.keys(RARITY_GEAR_UPGRADES).find(
    (option) => option.toLowerCase() === key.toLowerCase()
  );
  return matched ? RARITY_GEAR_UPGRADES[matched] : 0;
}

export function resolveUsedUpgradeLevel(slotValue, rarity) {
  const max = getMaxWeaponUpgrades(rarity);
  const raw = slotValue?.usedUpgradeLevel;
  const number = raw == null || raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.min(Math.floor(number), max);
}

export function createEmptyEquipmentSlot() {
  return {
    itemId: "",
    usedLevel: null,
    usedRarity: null,
    usedUpgradeLevel: 0,
    adornments: createEmptyAdornments()
  };
}

export function createEmptyAdornments() {
  return {
    stone: "",
    cursed: "", // legacy / reserved — Corrupted Gifts not implemented in UI yet
    enchantment: "", // legacy shared key — migrated to hands/feet
    enchantmentHands: "",
    enchantmentFeet: "",
    sigil: "",
    plate: "",
    embroidery: ""
  };
}

/** Normalize adornments for a slot (migrates legacy plate-on-cape / embroidery-on-chest). */
export function resolveSlotAdornments(slotKey, adornments) {
  const next = {
    ...createEmptyAdornments(),
    ...(adornments && typeof adornments === "object" ? adornments : {})
  };

  for (const key of Object.keys(next)) {
    if (typeof next[key] !== "string") {
      next[key] = "";
    }
  }

  if (slotKey === "back" && !next.embroidery && next.plate) {
    next.embroidery = next.plate;
    next.plate = "";
  }

  if (slotKey === "chest" && !next.plate && next.embroidery) {
    next.plate = next.embroidery;
    next.embroidery = "";
  }

  // Legacy: Cursed Eyes used to live in a separate "cursed" field — fold into Pedra.
  if (
    (slotKey === "ring1" || slotKey === "ring2" || slotKey === "pendant") &&
    !next.stone &&
    next.cursed &&
    /cursed eye/i.test(next.cursed)
  ) {
    next.stone = next.cursed;
    next.cursed = "";
  }

  // Legacy: shared enchantment key → hands/feet specific keys.
  if (slotKey === "hands" && !next.enchantmentHands && next.enchantment) {
    next.enchantmentHands = next.enchantment;
    next.enchantment = "";
  }

  if (slotKey === "feet" && !next.enchantmentFeet && next.enchantment) {
    next.enchantmentFeet = next.enchantment;
    next.enchantment = "";
  }

  return next;
}

/** Which upgrade fields each equipment slot supports in Farever. */
export function getAdornmentFieldsForSlot(slotKey) {
  switch (slotKey) {
    case "head":
      return [{ key: "sigil", label: "Demon Sigil", placeholder: "Ex.: Sigil of Bet'Hatesht" }];
    case "ring1":
    case "ring2":
    case "pendant":
      return [{ key: "stone", label: "Pedra", placeholder: "Ex.: Sundered Cut Agate / Cursed Eye" }];
    case "hands":
      return [
        {
          key: "enchantmentHands",
          label: "Magic Formula",
          placeholder: "Ex.: Magic Formula: Strength"
        }
      ];
    case "feet":
      return [
        {
          key: "enchantmentFeet",
          label: "Magic Formula",
          placeholder: "Ex.: Magic Formula: Armor"
        }
      ];
    case "chest":
      return [{ key: "plate", label: "Plate", placeholder: "Ex.: Reinforced Bronze Plate" }];
    case "back":
      return [{ key: "embroidery", label: "Embroidery", placeholder: "Ex.: Reinforced Soft Embroidery" }];
    default:
      return [];
  }
}

export function getAugmentSubcategory(augment) {
  return String(augment?.family ?? augment?.properties?.subcategory ?? "").trim();
}

export function isCorruptedGiftAugment(augment) {
  if (!augment) {
    return false;
  }
  const subcategory = getAugmentSubcategory(augment).toLowerCase();
  const kind = String(augment.adornmentKind ?? "").toLowerCase();
  return (
    kind === "corrupted" ||
    subcategory.includes("corrupted gift") ||
    /corrupted gift/i.test(String(augment.name ?? ""))
  );
}

export function isCursedEyeAugment(augment) {
  if (!augment) {
    return false;
  }
  const subcategory = getAugmentSubcategory(augment).toLowerCase();
  return subcategory.includes("cursed eye") || /cursed eye/i.test(String(augment.name ?? ""));
}

export function isDemonSigilAugment(augment) {
  if (!augment) {
    return false;
  }
  const kind = String(augment.adornmentKind ?? "").toLowerCase();
  const subcategory = getAugmentSubcategory(augment).toLowerCase();
  return (
    kind === "sigil" ||
    subcategory.includes("demon sigil") ||
    /^DemonSigil_/i.test(String(augment.id ?? ""))
  );
}

export function getDemonSigilTalentName(augment) {
  const description = String(augment?.description ?? "");
  const match = description.match(/grants the talent\s+(.+?)\.?$/i);
  return match ? match[1].trim() : "";
}

export function getAugmentClasses(augment) {
  const fromRoot = Array.isArray(augment?.classes) ? augment.classes : [];
  const fromProps = Array.isArray(augment?.properties?.classes) ? augment.properties.classes : [];
  const values = [...fromRoot, ...fromProps].map((value) => String(value).trim()).filter(Boolean);
  return [...new Set(values)];
}

export function augmentMatchesCharacterClass(augment, className) {
  if (!className) {
    return true;
  }
  const classes = getAugmentClasses(augment);
  if (!classes.length) {
    return true;
  }
  const wanted = String(className).trim().toLowerCase();
  const aliases = {
    warrior: ["warrior", "fighter"],
    rogue: ["rogue", "assassin"],
    mage: ["mage", "wizard"],
    priest: ["priest", "cleric"]
  };
  const wantedSet = new Set(aliases[wanted] || [wanted]);
  return classes.some((value) => wantedSet.has(String(value).trim().toLowerCase()));
}

export function getAugmentDisplayName(augment) {
  if (!augment) {
    return "";
  }

  const base = String(augment.name ?? "").trim();
  if (!base) {
    return "";
  }
  if (isDemonSigilAugment(augment)) {
    const talent = getDemonSigilTalentName(augment);
    return talent ? `${base} (${talent})` : base;
  }
  return base;
}

function normalizeAugmentLookup(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

/** Resolve an adornment name against the augments catalog (exact, then soft match). */
export function findAugmentByName(augments, name, adornmentKind = "") {
  const wanted = normalizeAugmentLookup(name);
  if (!wanted) {
    return null;
  }

  const pool = adornmentKind
    ? augments.filter((item) => augmentMatchesAdornmentField(item, adornmentKind))
    : augments;

  const exact = pool.find((item) => {
    const names = [item.name, getAugmentDisplayName(item), item.slug, item.id]
      .filter(Boolean)
      .map((value) => normalizeAugmentLookup(value));
    return names.includes(wanted);
  });
  if (exact) {
    return exact;
  }

  return (
    pool.find((item) => {
      const candidates = [item.name, getAugmentDisplayName(item), item.slug, item.id]
        .filter(Boolean)
        .map((value) => normalizeAugmentLookup(value));
      return candidates.some((candidate) => {
        if (candidate.includes(wanted) || wanted.includes(candidate)) {
          return true;
        }
        const softWanted = wanted.replace(/\bgate\b/g, "agate");
        const softCandidate = candidate.replace(/\bgate\b/g, "agate");
        return softCandidate.includes(softWanted) || softWanted.includes(softCandidate);
      });
    }) ?? null
  );
}

export function augmentMatchesAdornmentField(augment, fieldKey) {
  if (!augment || !fieldKey) {
    return false;
  }

  // Corrupted Gifts stay in the DB but are not selectable yet.
  if (isCorruptedGiftAugment(augment)) {
    return false;
  }

  const kind = String(augment.adornmentKind ?? "").toLowerCase();
  const subcategory = getAugmentSubcategory(augment).toLowerCase();

  if (fieldKey === "stone") {
    return (
      kind === "stone" ||
      subcategory.includes("gem") ||
      isCursedEyeAugment(augment) ||
      kind === "cursed"
    );
  }

  if (fieldKey === "cursed") {
    // Reserved for future Corrupted Gift UI — intentionally empty for now.
    return false;
  }

  if (fieldKey === "sigil") {
    return isDemonSigilAugment(augment);
  }

  if (fieldKey === "enchantment" || fieldKey === "enchantmentHands" || fieldKey === "enchantmentFeet") {
    if (fieldKey === "enchantmentHands") {
      return (
        kind === "enchantment-hands" ||
        subcategory.includes("enchantment (hands)") ||
        (subcategory.includes("enchant") && subcategory.includes("hands"))
      );
    }
    if (fieldKey === "enchantmentFeet") {
      return (
        kind === "enchantment-feet" ||
        subcategory.includes("enchantment (feet)") ||
        (subcategory.includes("enchant") && subcategory.includes("feet"))
      );
    }
    // Legacy shared key — keep matching any hand/foot formula, not weapon.
    return (
      (kind === "enchantment" || subcategory.includes("enchant")) &&
      !subcategory.includes("weapon")
    );
  }

  if (fieldKey === "plate") {
    return kind === "plate" || (subcategory.includes("plate") && !subcategory.includes("embroider"));
  }

  if (fieldKey === "embroidery") {
    return kind === "embroidery" || subcategory.includes("embroider");
  }

  return kind === fieldKey;
}

export function createEmptyEquipment() {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.key, createEmptyEquipmentSlot()]));
}

export const MAX_BUILD_SETS = 5;
export const BUILD_SET_LABELS = ["A", "B", "C", "D", "E"];

export function createEmptyBuildSet(statsFallback = DEFAULT_BUILD, label = "A") {
  return {
    id: `set${label}`,
    label,
    equipment: createEmptyEquipment(),
    stats: { ...statsFallback },
    classSkills: createEmptyClassSkills(),
    talents: createEmptyTalents(),
    arsenal: createEmptyArsenal()
  };
}

export function createEmptyClassSkills() {
  return {
    /** skillId → selected rune id */
    runesBySkillId: {},
    /** Up to CLASS_SKILL_MAX_ACTIVE active bar skills */
    activeSkillIds: [],
    /** False = still using unlock-order defaults */
    activeSkillsTouched: false
  };
}

export function createEmptyTalents() {
  return {
    /** talentId → points spent */
    pointsById: {}
  };
}

/** Arsenal weapon kit: up to 2 picks shared between skills and passives. */
export function createEmptyArsenal() {
  return {
    selectedIds: []
  };
}

export const ARSENAL_MAX_PICKS = 2;

export const TALENT_POINTS_AT_LEVEL_25 = 17;

export function createEmptyCharacterBuild() {
  return {
    version: 2,
    levelDefaultsVersion: 2,
    sets: [createEmptyBuildSet(DEFAULT_BUILD, "A")]
  };
}

export function getBuildSetLabel(index) {
  return BUILD_SET_LABELS[index] ?? String(index + 1);
}

function defaultStatsForIndex(index) {
  return index === 1 ? DEFAULT_BUILD_B : DEFAULT_BUILD;
}

function relabelBuildSets(sets) {
  return sets.map((set, index) => {
    const label = getBuildSetLabel(index);
    return {
      ...set,
      id: `set${label}`,
      label
    };
  });
}

/** Faction base levels when MetaForge omits level or stores bogus level 1 on armor. */
const ARMOR_FACTION_BASE_LEVELS = {
  RManfish: 25,
  RKobold: 25,
  RBee: 25,
  RCrimson: 25,
  RDemon: 25
};

const ARMOR_SLOT_SUBCATEGORIES = new Set([
  "Head",
  "Shoulders",
  "Chest",
  "Back",
  "Hands",
  "Waist",
  "Legs",
  "Feet"
]);

function armorFactionKeyFromId(itemId) {
  const id = String(itemId ?? "");
  for (const key of Object.keys(ARMOR_FACTION_BASE_LEVELS)) {
    if (id.includes(`_${key}`) || id.includes(`${key}_`)) {
      return key;
    }
  }
  return null;
}

function isArmorCatalogItem(item) {
  const sub = item?.properties?.subcategory ?? item?.properties?.type ?? item?.family;
  if (ARMOR_SLOT_SUBCATEGORIES.has(String(sub ?? ""))) {
    return true;
  }
  return armorFactionKeyFromId(item?.id) != null;
}

function isStarterCatalogItem(item) {
  const id = String(item?.id ?? "");
  if (/_Start$/i.test(id) || /_Starter_/i.test(id) || /^Starter_/i.test(id)) {
    return true;
  }
  const sources = Array.isArray(item?.sources) ? item.sources : [];
  return sources.some((source) => String(source?.kind ?? "").toLowerCase() === "starter");
}

/** Correct missing / level-1 Demon templates using faction defaults. */
function resolveArmorCatalogLevel(item) {
  if (!item || !isArmorCatalogItem(item) || isStarterCatalogItem(item)) {
    return null;
  }

  const faction = armorFactionKeyFromId(item.id);
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

export function getItemCatalogLevel(item) {
  const corrected = resolveArmorCatalogLevel(item);
  if (corrected != null) {
    return corrected;
  }

  const value = item?.itemLevel ?? item?.properties?.level ?? item?.properties?.ilevel;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Soft level cap for dungeon/world drops in current EA. */
export const MAX_DROP_ITEM_LEVEL = 25;

/** Starter / merchant-bought weapons as Rare. */
export const STARTER_SHOP_ITEM_LEVEL = 20;

export function clampItemLevel(level, { min = 1, max = MAX_DROP_ITEM_LEVEL } = {}) {
  const number = Number(level);
  if (!Number.isFinite(number)) {
    return max;
  }
  return Math.min(max, Math.max(min, Math.floor(number)));
}

/** Crafted gear has a fixed item level (does not scale with drop/receive level). */
export function isCraftedItem(item) {
  if (!item) {
    return false;
  }

  const sources = Array.isArray(item.sources) ? item.sources : [];
  if (sources.some((source) => String(source?.kind ?? "").toLowerCase() === "craft")) {
    return true;
  }

  const id = String(item.id ?? "");
  if (/Craft/i.test(id)) {
    return true;
  }

  const text = sources.map((source) => String(source?.text ?? "")).join(" ");
  return /\bcraft(?:ed|ing)?\b/i.test(text);
}

/** Bought from a merchant (Valley, wandering, starter kit, etc.). */
export function isShopPurchasableItem(item) {
  if (!item) {
    return false;
  }

  const id = String(item.id ?? "");
  if (/_Start$/i.test(id) || /^Starter_/i.test(id) || /_Starter_/i.test(id)) {
    return true;
  }

  const sources = Array.isArray(item.sources) ? item.sources : [];
  return sources.some((source) => {
    const kind = String(source?.kind ?? "").toLowerCase();
    if (kind === "shop" || kind === "starter") {
      return true;
    }
    return /valley merchant|wandering merchant/i.test(String(source?.text ?? ""));
  });
}

/**
 * Pure crafts (not sold in shops) keep a fixed catalog level.
 * Shop-buyable "_Craft" weapons (Valley L20) stay editable.
 */
export function isFixedCraftLevelItem(item) {
  return isCraftedItem(item) && !isShopPurchasableItem(item);
}

/** Default used level when equipping / when slot level is unset. */
export function getDefaultUsedLevel(item) {
  if (!item) {
    return MAX_DROP_ITEM_LEVEL;
  }

  // Merchant / starter purchases default to 20.
  if (isShopPurchasableItem(item)) {
    return STARTER_SHOP_ITEM_LEVEL;
  }

  // Pure crafts: locked catalog craft level (still capped at EA max).
  if (isFixedCraftLevelItem(item)) {
    return clampItemLevel(getItemCatalogLevel(item) ?? MAX_DROP_ITEM_LEVEL);
  }

  // Drops / caches / world loot: soft cap 25.
  return MAX_DROP_ITEM_LEVEL;
}

/** Level badge on bag icons: what the item equips at by default. */
export function getItemIconLevel(item) {
  return getDefaultUsedLevel(item);
}

export function resolveUsedLevel(slotValue, item) {
  if (isFixedCraftLevelItem(item)) {
    return clampItemLevel(getItemCatalogLevel(item) ?? getDefaultUsedLevel(item));
  }

  const fallback = getDefaultUsedLevel(item);

  if (slotValue?.usedLevel == null || slotValue.usedLevel === "") {
    return fallback;
  }

  const number = Number(slotValue.usedLevel);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return clampItemLevel(number);
}

export function normalizeEquipmentSlot(value) {
  if (!value || typeof value !== "object") {
    return createEmptyEquipmentSlot();
  }

  const itemId = typeof value.itemId === "string" ? value.itemId : "";
  const usedLevel = value.usedLevel == null || value.usedLevel === "" ? null : Number(value.usedLevel);
  const usedRarityRaw = typeof value.usedRarity === "string" ? value.usedRarity.trim() : "";
  const usedRarity =
    WEAPON_RARITY_OPTIONS.find((option) => option.toLowerCase() === usedRarityRaw.toLowerCase()) ?? null;
  const upgradeRaw =
    value.usedUpgradeLevel == null || value.usedUpgradeLevel === "" ? 0 : Number(value.usedUpgradeLevel);
  const usedUpgradeLevel = Number.isFinite(upgradeRaw) ? Math.max(0, Math.floor(upgradeRaw)) : 0;
  const adornments = createEmptyAdornments();
  if (value.adornments && typeof value.adornments === "object") {
    for (const key of Object.keys(adornments)) {
      if (typeof value.adornments[key] === "string") {
        adornments[key] = value.adornments[key];
      }
    }
  }

  return {
    itemId,
    usedLevel: Number.isFinite(usedLevel) ? clampItemLevel(usedLevel) : null,
    usedRarity,
    usedUpgradeLevel,
    adornments
  };
}

export function normalizeBuildSet(value, statsFallback) {
  const fallback = createEmptyBuildSet(statsFallback);
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const equipment = createEmptyEquipment();
  for (const slot of EQUIPMENT_SLOTS) {
    equipment[slot.key] = normalizeEquipmentSlot(value.equipment?.[slot.key]);
  }

  // Migrate old secondaryWeapon-only saves; arsenal is new.
  if (!value.equipment?.arsenal && value.equipment?.secondaryWeapon && !equipment.arsenal.itemId) {
    equipment.arsenal = createEmptyEquipmentSlot();
  }

  const stats = { ...statsFallback };
  if (value.stats && typeof value.stats === "object") {
    for (const key of Object.keys(statsFallback)) {
      if (value.stats[key] != null && Number.isFinite(Number(value.stats[key]))) {
        stats[key] = Number(value.stats[key]);
      }
    }
  }

  const classSkills = normalizeClassSkills(value.classSkills);
  const talents = normalizeTalents(value.talents);
  const arsenal = normalizeArsenal(value.arsenal);

  return { equipment, stats, classSkills, talents, arsenal };
}

function normalizeClassSkills(value) {
  const fallback = createEmptyClassSkills();
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const runesBySkillId = {};
  if (value.runesBySkillId && typeof value.runesBySkillId === "object") {
    for (const [skillId, runeId] of Object.entries(value.runesBySkillId)) {
      if (typeof skillId === "string" && typeof runeId === "string" && runeId) {
        runesBySkillId[skillId] = runeId;
      }
    }
  }

  const activeSkillIds = [];
  const pushActive = (skillId) => {
    if (typeof skillId === "string" && skillId && !activeSkillIds.includes(skillId)) {
      activeSkillIds.push(skillId);
    }
  };
  if (Array.isArray(value.activeSkillIds)) {
    for (const skillId of value.activeSkillIds) {
      if (isLevel30Skill({ id: skillId }) || CLASS_SIGNATURE_SKILL_IDS.has(skillId)) {
        continue;
      }
      pushActive(skillId);
      if (activeSkillIds.length >= CLASS_SKILL_MAX_ACTIVE) {
        break;
      }
    }
  }

  const activeSkillsTouched =
    value.activeSkillsTouched === true ||
    (value.activeSkillsTouched !== false && activeSkillIds.length > 0);

  return { runesBySkillId, activeSkillIds, activeSkillsTouched };
}

function normalizeTalents(value) {
  const fallback = createEmptyTalents();
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const pointsById = {};
  if (value.pointsById && typeof value.pointsById === "object") {
    for (const [talentId, points] of Object.entries(value.pointsById)) {
      const amount = Number(points);
      if (typeof talentId === "string" && Number.isFinite(amount) && amount > 0) {
        pointsById[talentId] = Math.floor(amount);
      }
    }
  }
  return { pointsById };
}

function normalizeArsenal(value) {
  const fallback = createEmptyArsenal();
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const selectedIds = [];
  const pushId = (skillId) => {
    if (typeof skillId === "string" && skillId && !selectedIds.includes(skillId)) {
      selectedIds.push(skillId);
    }
  };

  if (Array.isArray(value.selectedIds)) {
    for (const skillId of value.selectedIds) {
      pushId(skillId);
      if (selectedIds.length >= ARSENAL_MAX_PICKS) {
        break;
      }
    }
  } else {
    // Migrate older saves: skillIds + passiveId → shared selectedIds
    if (Array.isArray(value.skillIds)) {
      for (const skillId of value.skillIds) {
        pushId(skillId);
        if (selectedIds.length >= ARSENAL_MAX_PICKS) {
          break;
        }
      }
    }
    if (selectedIds.length < ARSENAL_MAX_PICKS && typeof value.passiveId === "string") {
      pushId(value.passiveId);
    }
  }

  return { selectedIds };
}

/** Bumps equipped usedLevels to shop/drop defaults (20/25) and clamps to EA max. */
export function promoteEquipmentToDefaultLevels(equipment, itemsById, { forceDefaults = false } = {}) {
  const next = createEmptyEquipment();
  let changed = false;

  for (const slot of EQUIPMENT_SLOTS) {
    const current = normalizeEquipmentSlot(equipment?.[slot.key]);
    next[slot.key] = current;

    if (!current.itemId || !itemsById?.get) {
      continue;
    }

    const item = itemsById.get(current.itemId);
    if (!item) {
      continue;
    }

    const desired = getDefaultUsedLevel(item);
    const raw = current.usedLevel;
    const numeric = Number(raw);
    const needsPromote =
      raw == null ||
      raw === "" ||
      !Number.isFinite(numeric) ||
      numeric > MAX_DROP_ITEM_LEVEL ||
      (forceDefaults && !isFixedCraftLevelItem(item) && numeric < desired);

    if (needsPromote) {
      const nextLevel =
        numeric > MAX_DROP_ITEM_LEVEL && !forceDefaults && Number.isFinite(numeric)
          ? MAX_DROP_ITEM_LEVEL
          : desired;
      next[slot.key] = {
        ...current,
        usedLevel: nextLevel
      };
      changed = true;
    }
  }

  return changed ? next : equipment;
}

export function promoteCharacterBuildLevels(build, itemsById) {
  const normalized = normalizeCharacterBuild(build);
  const forceDefaults = Number(normalized.levelDefaultsVersion) < 2;
  let changed = forceDefaults;
  const sets = normalized.sets.map((set) => {
    const nextEquipment = promoteEquipmentToDefaultLevels(set.equipment, itemsById, { forceDefaults });
    if (nextEquipment === set.equipment) {
      return set;
    }
    changed = true;
    return { ...set, equipment: nextEquipment };
  });

  if (!changed) {
    return build;
  }

  return {
    ...normalized,
    levelDefaultsVersion: 2,
    sets
  };
}

function migrateLegacyBuildSets(value) {
  const sets = [];
  if (value?.setA) {
    sets.push(normalizeBuildSet(value.setA, DEFAULT_BUILD));
  }
  if (value?.setB) {
    sets.push(normalizeBuildSet(value.setB, DEFAULT_BUILD_B));
  }
  if (sets.length === 0) {
    sets.push(createEmptyBuildSet(DEFAULT_BUILD, "A"));
  }
  return relabelBuildSets(sets.slice(0, MAX_BUILD_SETS));
}

export function normalizeCharacterBuild(value) {
  const fallback = createEmptyCharacterBuild();
  if (!value || typeof value !== "object") {
    return fallback;
  }

  let sets;
  if (Array.isArray(value.sets) && value.sets.length > 0) {
    sets = relabelBuildSets(
      value.sets.slice(0, MAX_BUILD_SETS).map((set, index) =>
        normalizeBuildSet(set, defaultStatsForIndex(index))
      )
    );
  } else {
    sets = migrateLegacyBuildSets(value);
  }

  return {
    version: 2,
    levelDefaultsVersion: Number(value.levelDefaultsVersion) || 1,
    sets
  };
}

export function addCharacterBuildSet(build, sourceIndex = 0) {
  const normalized = normalizeCharacterBuild(build);
  if (normalized.sets.length >= MAX_BUILD_SETS) {
    return normalized;
  }

  const source = normalized.sets[sourceIndex] ?? normalized.sets[0];
  const nextIndex = normalized.sets.length;
  const nextSet = {
    ...structuredClone(source),
    stats: { ...(source?.stats ?? defaultStatsForIndex(nextIndex)) }
  };

  return {
    ...normalized,
    sets: relabelBuildSets([...normalized.sets, nextSet])
  };
}

export function removeCharacterBuildSet(build, index) {
  const normalized = normalizeCharacterBuild(build);
  if (index <= 0 || index >= normalized.sets.length || normalized.sets.length <= 1) {
    return normalized;
  }

  return {
    ...normalized,
    sets: relabelBuildSets(normalized.sets.filter((_, setIndex) => setIndex !== index))
  };
}

export function getSlotDefinition(slotKey) {
  return EQUIPMENT_SLOTS.find((slot) => slot.key === slotKey) ?? null;
}

export function itemFitsSlot(item, slotKey) {
  const slot = getSlotDefinition(slotKey);
  if (!slot || !item) {
    return false;
  }

  if (item.collectionKey && item.collectionKey !== slot.collectionKey) {
    return false;
  }

  return slot.matches(item);
}
