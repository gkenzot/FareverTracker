import {
  CLASS_PRIMARY_ATTRIBUTE,
  aggregateBuildAttributes
} from "./aggregateBuildAttributes";
import { normalizeCharacterClassKey } from "./characterBaseStats";
import { DEFAULT_BUILD, DEFENSE_MODIFIER } from "./damageFormulas";
import { damageBucket } from "./weaponKitAnalysis";

const PRIMARY_KEYS = [
  { key: "strength", label: "Strength" },
  { key: "dexterity", label: "Dexterity" },
  { key: "intellect", label: "Intellect" },
  { key: "faith", label: "Faith" }
];

const MAGIC_CLASSES = new Set(["mage", "priest"]);

/** Share below this is treated as pure opposite bucket (avoids noisy 1% blends). */
const PURE_BUCKET_EPS = 0.05;

function classPrimaryKey(className) {
  const classKey = normalizeCharacterClassKey(className);
  const label = CLASS_PRIMARY_ATTRIBUTE[classKey] || "";
  return PRIMARY_KEYS.find((entry) => entry.label === label)?.key ?? "strength";
}

/**
 * Attribute 2 = primary with the majority contribution from the gear set
 * (excluding the class primary). Falls back to highest total among the others.
 */
export function resolveAttribute2FromBuild(attributes, className) {
  const classKey = classPrimaryKey(className);
  const gear = attributes?._breakdown?.gear ?? {};

  let bestKey = null;
  let bestGear = -Infinity;

  for (const { key } of PRIMARY_KEYS) {
    if (key === classKey) {
      continue;
    }
    const gearValue = Number(gear[key]) || 0;
    if (gearValue > bestGear) {
      bestGear = gearValue;
      bestKey = key;
    }
  }

  if (bestKey == null || bestGear <= 0) {
    let fallbackKey = null;
    let fallbackTotal = -Infinity;
    for (const { key } of PRIMARY_KEYS) {
      if (key === classKey) {
        continue;
      }
      const total = Number(attributes?.[key]) || 0;
      if (total > fallbackTotal) {
        fallbackTotal = total;
        fallbackKey = key;
      }
    }
    bestKey = fallbackKey;
  }

  if (!bestKey) {
    return { key: null, label: null, value: 0 };
  }

  const meta = PRIMARY_KEYS.find((entry) => entry.key === bestKey);
  return {
    key: bestKey,
    label: meta?.label ?? bestKey,
    value: Number(attributes?.[bestKey]) || 0
  };
}

function shareFromRows(rows, key) {
  const row = rows?.find((entry) => entry.key === key);
  return Number(row?.share) || 0;
}

function finalizeDamageProfile(physicalShare, magicShare, source) {
  let physical = Math.max(0, Number(physicalShare) || 0);
  let magic = Math.max(0, Number(magicShare) || 0);
  const total = physical + magic;

  if (total <= 0) {
    return null;
  }

  physical /= total;
  magic /= total;

  if (magic < PURE_BUCKET_EPS) {
    physical = 1;
    magic = 0;
  } else if (physical < PURE_BUCKET_EPS) {
    physical = 0;
    magic = 1;
  }

  const mode = magic === 0 ? "Physical" : physical === 0 ? "Magic" : "Mixed";
  const activePen =
    mode === "Physical" ? "armor" : mode === "Magic" ? "magic" : "blend";

  return {
    physicalShare: physical,
    magicShare: magic,
    mode,
    activePen,
    source
  };
}

function classFallbackDamageProfile(className) {
  const classKey = normalizeCharacterClassKey(className);
  if (MAGIC_CLASSES.has(classKey)) {
    return finalizeDamageProfile(0, 1, "class");
  }
  return finalizeDamageProfile(1, 0, "class");
}

function weaponAffinityDamageProfile(equipment, itemsById) {
  const itemId = equipment?.weapon?.itemId;
  if (!itemId || !itemsById?.get) {
    return null;
  }
  const item = itemsById.get(itemId);
  const affinity = item?.weaponDamage?.affinity ?? null;
  const bucket = affinity ? damageBucket(affinity) : null;
  if (bucket === "Physical") {
    return finalizeDamageProfile(1, 0, "weapon");
  }
  if (bucket === "Magic") {
    return finalizeDamageProfile(0, 1, "weapon");
  }
  return null;
}

/**
 * Damage-type profile that drives which penetration/mastery the sheet uses.
 * Priority: kit throughput by Physical/Magic → main-hand affinity → class fallback.
 */
export function resolveDamageProfile({
  kit = null,
  equipment = null,
  itemsById = null,
  className = ""
} = {}) {
  const damageRows = kit?.throughput?.damageByBucket;
  const damageTotal = damageRows?.reduce((sum, row) => sum + (Number(row.value) || 0), 0) || 0;
  if (damageTotal > 0) {
    return finalizeDamageProfile(
      shareFromRows(damageRows, "Physical"),
      shareFromRows(damageRows, "Magic"),
      "kit"
    );
  }

  const coeffRows = kit?.throughput?.byBucket?.length
    ? kit.throughput.byBucket
    : kit?.composition?.byBucket;
  const coeffTotal = coeffRows?.reduce((sum, row) => sum + (Number(row.value) || 0), 0) || 0;
  if (coeffTotal > 0) {
    return finalizeDamageProfile(
      shareFromRows(coeffRows, "Physical"),
      shareFromRows(coeffRows, "Magic"),
      "kit"
    );
  }

  return (
    weaponAffinityDamageProfile(equipment, itemsById) ?? classFallbackDamageProfile(className)
  );
}

export function formatDamageProfileLabel(profile) {
  if (!profile) {
    return "—";
  }
  if (profile.mode === "Physical") {
    return "Physical → Armor Pen";
  }
  if (profile.mode === "Magic") {
    return "Magic → Magic Pen";
  }
  const phys = Math.round((profile.physicalShare || 0) * 100);
  const magic = Math.round((profile.magicShare || 0) * 100);
  return `Mix ${phys}% Phys / ${magic}% Magic → Pen misturada`;
}

export function formatDamageProfileSource(profile) {
  if (!profile?.source) {
    return "";
  }
  if (profile.source === "kit") {
    return "kit (dano /min Physical vs Magic)";
  }
  if (profile.source === "weapon") {
    return "afinidade da main-hand";
  }
  return "fallback da classe";
}

/** Weighted effective pen (display / fallback). Live damage splits AP and MP by bucket. */
export function resolvePenetrationForProfile(attributes, profile) {
  const armor = Number(attributes?.armorPenetration) || 0;
  const magic = Number(attributes?.magicPenetration) || 0;
  if (!profile) {
    return armor;
  }
  return armor * (profile.physicalShare || 0) + magic * (profile.magicShare || 0);
}

/** Weighted effective mastery (display / fallback). Live damage splits by bucket. */
export function resolveMasteryForProfile(attributes, profile) {
  const physical = (Number(attributes?.physicalMastery) || 0) / 100;
  const magic = (Number(attributes?.magicMastery) || 0) / 100;
  if (!profile) {
    return physical;
  }
  return physical * (profile.physicalShare || 0) + magic * (profile.magicShare || 0);
}

/** Average weapon damage from MetaForge catalog (`item.weaponDamage.avg`). */
export function resolveMainHandWeaponDamage(equipment, itemsById) {
  const itemId = equipment?.weapon?.itemId;
  if (!itemId || !itemsById?.get) {
    return { value: 0, item: null, weaponDamage: null };
  }

  const item = itemsById.get(itemId) ?? null;
  const weaponDamage = item?.weaponDamage ?? null;
  const avg = Number(weaponDamage?.avg);
  return {
    value: Number.isFinite(avg) ? avg : 0,
    item,
    weaponDamage
  };
}

/**
 * Merge build sheet attributes into damage-formula inputs.
 * Weapon damage comes from the equipped main-hand catalog entry.
 * Skill modifier (and optional extras) stay as shared overrides.
 * Penetration/mastery follow damage type (Physical/Magic), not class.
 */
export function buildDamageStatsFromAttributes(attributes, className, overrides = {}) {
  const attr1Key = classPrimaryKey(className);
  const attr1Meta = PRIMARY_KEYS.find((entry) => entry.key === attr1Key);
  const attr2 = resolveAttribute2FromBuild(attributes, className);
  const weaponDamage =
    overrides.weaponDamage != null
      ? Number(overrides.weaponDamage) || 0
      : Number(DEFAULT_BUILD.weaponDamage) || 0;

  const damageProfile =
    overrides.damageProfile ??
    resolveDamageProfile({
      kit: overrides.kit ?? null,
      equipment: overrides.equipment ?? null,
      itemsById: overrides.itemsById ?? null,
      className
    });

  const physicalMastery = (Number(attributes?.physicalMastery) || 0) / 100;
  const magicMastery = (Number(attributes?.magicMastery) || 0) / 100;
  const armorPenetration = Number(attributes?.armorPenetration) || 0;
  const magicPenetration = Number(attributes?.magicPenetration) || 0;

  return {
    weaponDamage,
    modifier: Number(overrides.modifier ?? DEFAULT_BUILD.modifier) || 0,
    attribute1: Number(attributes?.[attr1Key]) || 0,
    attribute2: attr2.value,
    fervor: Number(attributes?.fervor) || 0,
    mastery: resolveMasteryForProfile(attributes, damageProfile),
    physicalMastery,
    magicMastery,
    criticalChance: Number(attributes?.criticalChance) || 0,
    criticalBonus: Number(attributes?.criticalBonus) || 0,
    extraDamage1: Number(overrides.extraDamage1 ?? 0) || 0,
    extraDamage2: Number(overrides.extraDamage2 ?? 0) || 0,
    /** Effective / display pen; live calc splits AP (Physical) and MP (Magic). */
    armorPen: resolvePenetrationForProfile(attributes, damageProfile),
    armorPenetration,
    magicPenetration,
    damageProfile,
    enemyDefense: Number(overrides.enemyDefense ?? DEFAULT_BUILD.enemyDefense) || 0,
    defenseModifier: Number(overrides.defenseModifier ?? DEFENSE_MODIFIER) || DEFENSE_MODIFIER,
    _meta: {
      attribute1Key: attr1Key,
      attribute1Label: attr1Meta?.label ?? attr1Key,
      attribute2Key: attr2.key,
      attribute2Label: attr2.label,
      weaponName: overrides.weaponName ?? null,
      weaponDamageNote: overrides.weaponDamageNote ?? null,
      damageProfile
    }
  };
}

/** Aggregate equipment → attributes → damage stats for one build set. */
export function buildDamageStatsForSet(set, className, itemsById, augments, overrides = {}) {
  const attributes = aggregateBuildAttributes(set?.equipment, itemsById, augments, className);
  const mainHand = resolveMainHandWeaponDamage(set?.equipment, itemsById);
  const damageProfile =
    overrides.damageProfile ??
    resolveDamageProfile({
      kit: overrides.kit ?? null,
      equipment: set?.equipment,
      itemsById,
      className
    });

  return {
    attributes,
    stats: buildDamageStatsFromAttributes(attributes, className, {
      ...overrides,
      damageProfile,
      equipment: set?.equipment,
      itemsById,
      weaponDamage: mainHand.value,
      weaponName: mainHand.item?.name ?? null,
      weaponDamageNote: mainHand.weaponDamage?.note ?? null
    })
  };
}
