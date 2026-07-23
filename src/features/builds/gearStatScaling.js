/** Farever gear stat scaling (ported from SiagartaDB / game constants). */

export const STAT_CONSTANTS = {
  levelScalingMaxLevel: 50,
  gearStatsRatioStart: 0.5,
  gearStatsRatioEnd: 0.9,
  resistanceFormulaA: 385,
  resistanceFormulaB: 100,
  flawlessILevelBonus: 10,
  gearUpgradeILevelBonus: 10,
  rarityILevelBonus: {
    Common: 0,
    Uncommon: 0,
    Rare: 10,
    Epic: 30,
    Legendary: 50
  },
  aptitudeArmorReduction: {
    Fighter: 0.4,
    Assassin: 0.3,
    Wizard: 0.25,
    Cleric: 0.25
  },
  attributeScaling: {
    CritChance: [
      { attribute: "Dexterity", scale: 0.014 },
      { attribute: "Intellect", scale: 0.014 },
      { attribute: "CritChanceRating", scale: 0.1 }
    ],
    CritDamage: [
      { attribute: "Strength", scale: 0.01 },
      { attribute: "Faith", scale: 0.01 }
    ],
    ArmorPenetration: [{ attribute: "ArmorPenetrationRating", scale: 0.1 }],
    SpellPenetration: [{ attribute: "SpellPenetrationRating", scale: 0.1 }],
    Fervor: [{ attribute: "FervorRating", scale: 0.05 }],
    MaxHealth: [{ attribute: "Vitality", scale: 3 }]
  }
};

const STAT_GROUP = {
  0: "primary",
  1: "vitality",
  2: "armor",
  3: "ratings"
};

const RARITY_RANK = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4
};

export const ATTR_LABELS = {
  Strength: "Strength",
  Dexterity: "Dexterity",
  Intellect: "Intellect",
  Faith: "Faith",
  Vitality: "Vitality",
  Armor: "Armor",
  MagicResistance: "Magic Resistance",
  CritChanceRating: "Critical",
  ArmorPenetrationRating: "Armor Penetration",
  SpellPenetrationRating: "Magic Penetration",
  FervorRating: "Fervor",
  MaxHealth: "Max Health",
  WeaponDamage: "Weapon Damage"
};

function lerpPow(start, end, t) {
  if (start <= 0 || end <= 0) {
    return 0;
  }
  return start * Math.pow(end / start, t);
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeItemLevel({ level, rarity, flawless = false, upgradeLevel = 0, iLevel = null }) {
  if (level != null && Number.isFinite(Number(level))) {
    const rarityBonus = STAT_CONSTANTS.rarityILevelBonus[rarity] ?? 0;
    const flawlessBonus = flawless ? STAT_CONSTANTS.flawlessILevelBonus : 0;
    const upgradeBonus = (upgradeLevel ?? 0) * STAT_CONSTANTS.gearUpgradeILevelBonus;
    return 10 * Number(level) + rarityBonus + flawlessBonus + upgradeBonus;
  }
  return iLevel == null ? null : Number(iLevel);
}

/**
 * @param {object} payload statsScale from catalog (Siagarta gear payload)
 * @param {{ level: number, rarity: string, flawless?: boolean, upgradeLevel?: number }} options
 * @returns {{ label: string, value: number, attribute: string }[]}
 */
export function computeGearStats(payload, options = {}) {
  if (!payload?.baseApts?.length || !payload?.scalings) {
    return [];
  }

  const rarity = options.rarity || payload.rarity || "Rare";
  const level = options.level;
  const flawless = options.flawless ?? payload.flawless ?? false;
  const upgradeLevel = options.upgradeLevel ?? payload.upgradeLevel ?? 0;

  const {
    levelScalingMaxLevel: maxLevel,
    gearStatsRatioStart,
    gearStatsRatioEnd,
    resistanceFormulaA,
    resistanceFormulaB,
    aptitudeArmorReduction,
    attributeScaling
  } = STAT_CONSTANTS;

  const itemLevel = computeItemLevel({ level, rarity, flawless, upgradeLevel });
  if (itemLevel == null || !Number.isFinite(itemLevel)) {
    return [];
  }

  const baseApts = payload.baseApts;
  const aptCount = baseApts.length || 1;
  const h = itemLevel / 10;
  const t = Math.max(0, Math.min(1, (h - 1) / (maxLevel - 1)));
  const gearRatio = lerpPow(gearStatsRatioStart, gearStatsRatioEnd, t);
  const faction = payload.faction ?? null;

  const byEndAtb = new Map();
  for (const apt of baseApts) {
    for (const scaling of payload.scalings?.[apt] ?? []) {
      const minRarity = scaling.conds?.minRarity;
      if (minRarity && (RARITY_RANK[rarity] ?? 0) < (RARITY_RANK[minRarity] ?? 0)) {
        continue;
      }
      const factions = scaling.conds?.factions;
      if (factions?.length && !(faction && factions.some((entry) => entry?.ref === faction))) {
        continue;
      }
      const list = byEndAtb.get(scaling.endAtb) ?? [];
      list.push(scaling);
      byEndAtb.set(scaling.endAtb, list);
    }
  }

  const bySource = new Map();
  for (const [endAtb, list] of byEndAtb) {
    if (!list.length) {
      continue;
    }

    const first = list[0];
    const groupKey = first.statGroup !== undefined ? STAT_GROUP[first.statGroup] : null;
    if (!groupKey) {
      continue;
    }

    const ratio = payload.atbRatio?.[groupKey];
    // 0 means "this budget is unused" (e.g. trinket primary); skip instead of emitting 0 stats.
    if (ratio == null || ratio === undefined || ratio === 0) {
      continue;
    }

    let value;
    if (endAtb === "Armor" || endAtb === "MagicResistance") {
      const reduction = average(baseApts.map((apt) => aptitudeArmorReduction[apt] ?? 0));
      value =
        reduction >= 1
          ? 0
          : (reduction * (resistanceFormulaA + resistanceFormulaB * h)) / (1 - reduction);
    } else {
      value = lerpPow(
        average(list.map((entry) => entry.start ?? 0)),
        average(list.map((entry) => entry.end ?? 0)),
        t
      );
    }

    if (!first.gearOnly) {
      value *= gearRatio;
    }
    value /= aptCount;
    value *= ratio;

    for (const entry of list) {
      const source = entry.sourceAtb ?? entry.endAtb;
      const previous = bySource.get(source);
      if (previous) {
        previous.val += value;
      } else {
        bySource.set(source, { targetAtb: endAtb, bucket: groupKey, val: value });
      }
    }
  }

  const stats = [];
  for (const [attribute, row] of bySource) {
    let value = row.val;
    if (attribute !== row.targetAtb) {
      const scaling = attributeScaling[row.targetAtb]?.find((entry) => entry.attribute === attribute);
      if (scaling && scaling.scale !== 0) {
        value /= scaling.scale;
      }
    }

    stats.push({
      attribute,
      label: ATTR_LABELS[attribute] ?? attribute,
      value: Math.round(value)
    });
  }

  return stats.sort((left, right) => left.label.localeCompare(right.label));
}

export function scaleItemStats(item, { level, rarity, upgradeLevel = 0, characterClassName } = {}) {
  const resolvedRarity = normalizeRarity(rarity || item?.rarity || item?.properties?.rarity || "Rare");
  const resolvedLevel = Number(
    level ?? item?.itemLevel ?? item?.properties?.level ?? MAX_DROP_FALLBACK_LEVEL
  );

  const staticStats = resolveStaticStats(item, characterClassName);

  // Crafted pieces often ship both fixed tooltip stats and a faction statsScale template.
  // Prefer the fixed stats when present — statsScale can invent extras (e.g. Demon Fervor on crafts).
  if (isCraftedItemId(item) && staticStats.length > 0) {
    return finalizeScaledStats(item, staticStats);
  }

  if (item?.statsScale) {
    const computed = computeGearStats(item.statsScale, {
      level: resolvedLevel,
      rarity: resolvedRarity,
      upgradeLevel: upgradeLevel ?? 0
    });
    if (computed.length > 0) {
      void characterClassName;
      return finalizeScaledStats(item, computed);
    }
  }

  if (!staticStats.length) {
    return [];
  }

  const referenceLevel = getStatsReferenceLevel(item);
  if (!Number.isFinite(resolvedLevel) || resolvedLevel === referenceLevel) {
    return finalizeScaledStats(item, staticStats);
  }

  return finalizeScaledStats(
    item,
    approximateScaledStats(staticStats, {
      baseLevel: referenceLevel,
      baseRarity: normalizeRarity(item?.rarity || item?.properties?.rarity || "Rare"),
      level: resolvedLevel,
      rarity: resolvedRarity,
      upgradeLevel: upgradeLevel ?? 0
    })
  );
}

const MAX_DROP_FALLBACK_LEVEL = 25;

/** Arsenal slot applies this fraction of the weapon’s normal sheet stats. */
export const ARSENAL_STAT_FACTOR = 0.4;

export function applyArsenalStatFactor(stats = []) {
  return stats
    .map((stat) => ({
      ...stat,
      value: Math.round((Number(stat.value) || 0) * ARSENAL_STAT_FACTOR)
    }))
    .filter((stat) => Number(stat.value) !== 0);
}

function isCraftedItemId(item) {
  const id = String(item?.id ?? "");
  if (/Craft/i.test(id)) {
    return true;
  }
  const sources = Array.isArray(item?.sources) ? item.sources : [];
  return sources.some((source) => String(source?.kind ?? "").toLowerCase() === "craft");
}

function isTrinketItem(item) {
  const type = String(item?.properties?.subcategory ?? item?.properties?.type ?? item?.family ?? "")
    .trim()
    .toLowerCase();
  if (type === "trinket") {
    return true;
  }
  return /^Trinket_/i.test(String(item?.id ?? ""));
}

function finalizeScaledStats(item, stats) {
  const cleaned = (stats || [])
    .filter((stat) => Number(stat.value) !== 0)
    .map(({ label, value }) => ({ label, value: Number(value) || 0 }));

  // Trinkets never grant Vitality on the character sheet.
  if (isTrinketItem(item)) {
    return cleaned.filter((stat) => stat.label !== "Vitality");
  }

  return cleaned;
}

const PRIMARY_ATTRS = new Set([
  "Strength",
  "Dexterity",
  "Intellect",
  "Faith",
  "Vitality",
  "Max Health"
]);

function normalizeRarity(rarity) {
  const value = String(rarity ?? "").trim();
  if (!value || value === "—") {
    return "Rare";
  }
  return value;
}

/** Level assumed for stored static/MetaForge stats when scaling without statsScale. */
function getStatsReferenceLevel(item) {
  const catalog = Number(item?.itemLevel ?? item?.properties?.level);
  if (Number.isFinite(catalog) && catalog > 0) {
    return catalog;
  }

  if (item?.statsBaseLevel != null && Number.isFinite(Number(item.statsBaseLevel))) {
    return Number(item.statsBaseLevel);
  }

  // MetaForge scaled rows are typically endgame-ish; treat as L25 baseline.
  if (item?.statsSource === "metaforge") {
    return MAX_DROP_FALLBACK_LEVEL;
  }

  return 20;
}

function resolveStaticStats(item, characterClassName) {
  if (Array.isArray(item?.stats) && item.stats.length > 0) {
    return item.stats;
  }

  const byClass = item?.statsByClass;
  if (byClass && typeof byClass === "object") {
    const wanted = String(characterClassName ?? "")
      .trim()
      .toLowerCase();
    if (wanted) {
      for (const [key, stats] of Object.entries(byClass)) {
        if (String(key).trim().toLowerCase() === wanted && Array.isArray(stats) && stats.length) {
          return stats;
        }
      }
    }
    const first = Object.values(byClass).find((stats) => Array.isArray(stats) && stats.length > 0);
    if (first) {
      return first;
    }
  }

  return [];
}

function curveT(itemLevel) {
  const h = itemLevel / 10;
  return Math.max(0, Math.min(1, (h - 1) / (STAT_CONSTANTS.levelScalingMaxLevel - 1)));
}

function approximateScaledStats(baseStats, { baseLevel, baseRarity, level, rarity, upgradeLevel }) {
  const fromIL = computeItemLevel({ level: baseLevel, rarity: baseRarity, upgradeLevel: 0 });
  const toIL = computeItemLevel({ level, rarity, upgradeLevel });
  if (!fromIL || !toIL || fromIL === toIL) {
    return baseStats;
  }

  const tFrom = curveT(fromIL);
  const tTo = curveT(toIL);
  const primaryFrom =
    lerpPow(30, 540, tFrom) *
    lerpPow(STAT_CONSTANTS.gearStatsRatioStart, STAT_CONSTANTS.gearStatsRatioEnd, tFrom);
  const primaryTo =
    lerpPow(30, 540, tTo) *
    lerpPow(STAT_CONSTANTS.gearStatsRatioStart, STAT_CONSTANTS.gearStatsRatioEnd, tTo);
  const ratingFrom = lerpPow(150, 1000, tFrom);
  const ratingTo = lerpPow(150, 1000, tTo);
  const armorFrom = lerpPow(160, 1800, tFrom);
  const armorTo = lerpPow(160, 1800, tTo);
  const primaryFactor = primaryFrom > 0 ? primaryTo / primaryFrom : 1;
  const ratingFactor = ratingFrom > 0 ? ratingTo / ratingFrom : 1;
  const armorFactor = armorFrom > 0 ? armorTo / armorFrom : 1;

  return baseStats.map((stat) => {
    let factor = ratingFactor;
    if (PRIMARY_ATTRS.has(stat.label)) {
      factor = primaryFactor;
    } else if (stat.label === "Armor" || stat.label === "Magic Resistance") {
      factor = armorFactor;
    }

    return {
      label: stat.label,
      value: Math.max(0, Math.round(Number(stat.value) * factor))
    };
  });
}
