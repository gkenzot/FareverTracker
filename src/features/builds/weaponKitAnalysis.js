/**
 * Weapons / kit analysis from tooltips + arsenal + class skills + talents.
 * Throughput: on-CD skills + optional passives/DoTs/conduits under uptime assumptions.
 * Base hit: weaponDamage + Σ(coeff × attr).
 */

import { isLevel30Skill, resolveActiveClassSkillIds } from "./classSkillLoadout";
import { getWeaponSubcategory, listWeaponKitSkills, resolveWeaponMeta } from "./weaponKitHelpers";

const VALID_ATTRS = new Set(["Strength", "Intellect", "Dexterity", "Faith", "Vitality", "Armor"]);
const VALID_TYPES = new Set(["Physical", "Magic", "Fire", "Light", "Water", "Chaos", "Spark", "Raw"]);

const DAMAGE_HIT_RE =
  /(\d+(?:\.\d+)?)\s*%\s+(Strength|Intellect|Dexterity|Faith|Vitality|Armor)\s+(Physical|Magic|Fire|Light|Water|Chaos|Spark|Raw)\s+damage/gi;

const MAGIC_BUCKET = new Set(["Magic", "Fire", "Light", "Water", "Chaos", "Spark", "Raw"]);

const ATTR_TO_KEY = {
  Strength: "strength",
  Intellect: "intellect",
  Dexterity: "dexterity",
  Faith: "faith",
  Vitality: "vitality",
  Armor: "armor"
};

const CLASS_SKILL_KINDS = new Set(["Active", "Signature", "Prayer", "Conduit"]);
const CLASS_THROUGHPUT_KINDS = new Set(["Active", "Signature", "Prayer"]);

/** Default combat assumptions for conditional talents and passive/DoT throughput. */
export const DEFAULT_KIT_ASSUMPTIONS = {
  poisoned: 0.7,
  chaincast: 0.5,
  sunlight: 0.4,
  rageShield: 0.3,
  includeTalentDamage: true,
  includeConduits: false,
  /** Effective procs/min for interval passives (unused while weapon passives are ignored). */
  passiveProcsPerMin: 6,
  /** Assumed DoT / poison reapplications per minute. */
  dotAppsPerMin: 4,
  /** Assumed conduit triggers per minute. */
  conduitPerMin: 4
};

export const KIT_ASSUMPTION_FIELDS = [
  { key: "poisoned", label: "Poisoned uptime", kind: "percent" },
  { key: "chaincast", label: "Chaincast uptime", kind: "percent" },
  { key: "sunlight", label: "Sunlight uptime", kind: "percent" },
  { key: "rageShield", label: "Rage Shield uptime", kind: "percent" },
  { key: "passiveProcsPerMin", label: "Passive procs /min", kind: "number", step: 0.5, min: 0 },
  { key: "dotAppsPerMin", label: "DoT apps /min", kind: "number", step: 0.5, min: 0 },
  { key: "conduitPerMin", label: "Conduit procs /min", kind: "number", step: 0.5, min: 0 }
];

export const KIT_ASSUMPTION_TOGGLES = [
  { key: "includeTalentDamage", label: "Incluir talent DoTs/hits no /min" },
  { key: "includeConduits", label: "Incluir conduits no /min" }
];

export function normalizeKitAssumptions(value) {
  const next = { ...DEFAULT_KIT_ASSUMPTIONS };
  if (!value || typeof value !== "object") {
    return next;
  }
  for (const key of Object.keys(DEFAULT_KIT_ASSUMPTIONS)) {
    if (!(key in value)) {
      continue;
    }
    if (typeof DEFAULT_KIT_ASSUMPTIONS[key] === "boolean") {
      next[key] = Boolean(value[key]);
      continue;
    }
    const number = Number(value[key]);
    if (Number.isFinite(number)) {
      next[key] = Math.max(0, number);
    }
  }
  for (const key of ["poisoned", "chaincast", "sunlight", "rageShield"]) {
    next[key] = Math.min(1, next[key]);
  }
  return next;
}

export function damageBucket(type) {
  if (type === "Physical") {
    return "Physical";
  }
  if (MAGIC_BUCKET.has(type)) {
    return "Magic";
  }
  return "Other";
}

export function attributeStatKey(attrLabel) {
  return ATTR_TO_KEY[attrLabel] ?? null;
}

function skillMatchesClass(skill, className) {
  if (!className) {
    return false;
  }
  const wanted = String(className).trim().toLowerCase();
  return (skill.classes || []).some((value) => String(value).trim().toLowerCase() === wanted);
}

/** Parse tooltip hits like "105% Strength Physical damage". */
export function parseSkillDamageHits(description) {
  if (!description) {
    return [];
  }
  const hits = [];
  for (const match of String(description).matchAll(DAMAGE_HIT_RE)) {
    const attr = match[2];
    const type = match[3];
    if (!VALID_ATTRS.has(attr) || !VALID_TYPES.has(type)) {
      continue;
    }
    hits.push({
      coeff: Number(match[1]) / 100,
      coeffPercent: Number(match[1]),
      attr,
      type,
      bucket: damageBucket(type)
    });
  }
  return hits;
}

/** Detect interval / DoT cadence from tooltip text. */
export function parseDamageCadence(description) {
  const text = String(description || "");
  const every = text.match(/every\s+(\d+(?:\.\d+)?)s/i);
  const over = text.match(/over\s+(\d+(?:\.\d+)?)s/i);
  const duration = text.match(/for\s+(\d+(?:\.\d+)?)s/i);
  const chance = text.match(/\b(0?\.\d+|\d+(?:\.\d+)?)\s+chance\b/i);

  return {
    everySec: every ? Number(every[1]) : null,
    overSec: over ? Number(over[1]) : null,
    durationSec: duration ? Number(duration[1]) : null,
    procChance: chance ? Number(chance[1]) : null,
    isDot: Boolean(over) || /bleed|poison|burn|over\s+\d/i.test(text)
  };
}

function conditionUptime(assumptions, condition) {
  if (!condition) {
    return 1;
  }
  const value = Number(assumptions?.[condition]);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * Flat + conditional talent effects.
 * Conditional bonuses are returned with a `condition` key and scaled by assumptions later.
 */
export function parseTalentEffects(description, points = 1) {
  const text = String(description || "");
  const rank = Math.max(1, Number(points) || 1);
  const effects = {
    critChanceFlat: 0,
    critBonusFlat: 0,
    extraDamageFlat: 0,
    conditionals: [],
    notes: [],
    damageHits: parseSkillDamageHits(text)
  };

  const attackCritBonus = text.match(
    /Attacks deal\s+(\d+(?:\.\d+)?)%\s+increased critical damage/i
  );
  if (attackCritBonus) {
    effects.critBonusFlat += (Number(attackCritBonus[1]) / 100) * rank;
  }

  const weaponCritBonus = text.match(
    /WeaponSkills deal\s+(\d+(?:\.\d+)?)%\s+increased critical damage/i
  );
  if (weaponCritBonus) {
    // Kit throughput is mostly weapon skills — apply fully.
    effects.critBonusFlat += (Number(weaponCritBonus[1]) / 100) * rank;
  }

  const flatAttackCrit = text.match(
    /Attacks have an additional\s+(0?\.\d+|\d+(?:\.\d+)?)\s+chance to critically strike(?![^.]*poisoned)/i
  );
  if (flatAttackCrit) {
    effects.critChanceFlat += Number(flatAttackCrit[1]) * rank;
  }

  const poisonedCrit = text.match(
    /additional\s+(0?\.\d+|\d+(?:\.\d+)?)\s+chance to critically strike poisoned enemies/i
  );
  if (poisonedCrit) {
    effects.conditionals.push({
      condition: "poisoned",
      critChanceFlat: Number(poisonedCrit[1]) * rank,
      label: "crit vs poisoned"
    });
  }

  const sunlightCrit = text.match(
    /Sunlight has\s+(?:a\s+)?(0?\.\d+|\d+(?:\.\d+)?)\s+additional chance to critically strike/i
  );
  if (sunlightCrit) {
    effects.conditionals.push({
      condition: "sunlight",
      critChanceFlat: Number(sunlightCrit[1]) * rank,
      label: "crit on Sunlight"
    });
  }

  const chaincastDamage = text.match(
    /Damage dealt by your Attacks increased by\s+(\d+(?:\.\d+)?)%\s+while you are under Chaincast/i
  );
  if (chaincastDamage) {
    effects.conditionals.push({
      condition: "chaincast",
      extraDamageFlat: Number(chaincastDamage[1]) / 100 * rank,
      label: "Attack damage sob Chaincast"
    });
  }

  const poisonedDamage = text.match(
    /Damage dealt to poisoned enemies increased by\s+(\d+(?:\.\d+)?)%/i
  );
  if (poisonedDamage) {
    effects.conditionals.push({
      condition: "poisoned",
      extraDamageFlat: Number(poisonedDamage[1]) / 100 * rank,
      label: "damage vs poisoned"
    });
  }

  const rageShieldDamage = text.match(
    /Damage dealt increased by\s+(\d+(?:\.\d+)?)%[\s\S]*while Rage Shield is active/i
  );
  if (rageShieldDamage) {
    effects.conditionals.push({
      condition: "rageShield",
      extraDamageFlat: Number(rageShieldDamage[1]) / 100 * rank,
      label: "damage sob Rage Shield"
    });
  }

  const kineticSurge = text.match(
    /Chaincast increases the Physical damage of your next WeaponSkill by\s+(\d+(?:\.\d+)?)%/i
  );
  if (kineticSurge) {
    effects.conditionals.push({
      condition: "chaincast",
      extraDamageFlat: (Number(kineticSurge[1]) / 100) * rank * 0.35,
      label: "aprox. Kinetic Surge (35% dos casts)"
    });
  }

  if (/next ComboAttack/i.test(text) && !effects.conditionals.length) {
    effects.notes.push("próximo ComboAttack (burst — não modelado)");
  }

  return effects;
}

function resolveItem(equipment, itemsById, slotKey) {
  const itemId = equipment?.[slotKey]?.itemId;
  if (!itemId || !itemsById?.get) {
    return null;
  }
  return itemsById.get(itemId) ?? null;
}

function summarizeWeapon(item) {
  if (!item) {
    return null;
  }
  const wd = item.weaponDamage ?? null;
  const avg = Number(wd?.avg);
  const scalingRatio = Number(wd?.scalingRatio);
  return {
    id: item.id,
    name: item.name,
    subcategory: getWeaponSubcategory(item),
    affinity: wd?.affinity ?? null,
    bucket: wd?.affinity ? damageBucket(wd.affinity) : null,
    weaponDamageAvg: Number.isFinite(avg) ? avg : null,
    scalingAttr: wd?.scalingAttr || null,
    scalingRatio: Number.isFinite(scalingRatio) ? scalingRatio : null,
    scalingPercent: Number.isFinite(scalingRatio) ? scalingRatio * 100 : null
  };
}

function readAttrValue(attributes, attrLabel) {
  const key = attributeStatKey(attrLabel);
  if (!key || !attributes) {
    return 0;
  }
  return Number(attributes[key]) || 0;
}

function mergeDescriptions(...parts) {
  return parts.filter(Boolean).join("\n");
}

function resolveSoftRate({ kind, source, cadence, assumptions, cooldown }) {
  if (cooldown != null && cooldown > 0) {
    return {
      castsPerMin: 60 / cooldown,
      rateMode: "cooldown",
      rateNote: `CD ${cooldown}s`
    };
  }

  if (kind === "Conduit" || source === "conduit") {
    const rate = Number(assumptions.conduitPerMin) || 0;
    return {
      castsPerMin: rate,
      rateMode: "conduit",
      rateNote: `${rate}/min (assumido)`
    };
  }

  if (cadence.everySec != null && cadence.everySec > 0) {
    let rate = 60 / cadence.everySec;
    if (cadence.durationSec != null && cadence.durationSec > 0) {
      // e.g. active 4s window every proc — keep tick rate while up; scale by generic passive factor later via include flag
      rate = 60 / cadence.everySec;
    }
    return {
      castsPerMin: rate,
      rateMode: "interval",
      rateNote: `a cada ${cadence.everySec}s`
    };
  }

  if (cadence.isDot || cadence.overSec != null) {
    const rate = Number(assumptions.dotAppsPerMin) || 0;
    return {
      castsPerMin: rate,
      rateMode: "dot",
      rateNote: `${rate} apps/min (DoT)`
    };
  }

  const rate = Number(assumptions.passiveProcsPerMin) || 0;
  return {
    castsPerMin: rate,
    rateMode: "proc",
    rateNote: `${rate} procs/min`
  };
}

function skillEntry({
  skill,
  source,
  sourceLabel,
  includeInThroughput,
  weaponDamage,
  attributes,
  assumptions,
  descriptionOverride = null,
  runeName = null,
  talentPoints = null
}) {
  const description = descriptionOverride ?? skill.description;
  const hits = parseSkillDamageHits(description);
  const cadence = parseDamageCadence(description);
  const cooldown = skill.cooldown != null && Number(skill.cooldown) > 0 ? Number(skill.cooldown) : null;
  const rate = resolveSoftRate({
    kind: skill.kind,
    source,
    cadence,
    assumptions,
    cooldown
  });
  const castsPerMin = includeInThroughput ? rate.castsPerMin : null;
  const wd = Number(weaponDamage) || 0;

  const resolvedHits = hits.map((hit) => {
    const attrValue = readAttrValue(attributes, hit.attr);
    const attrDamage = hit.coeff * attrValue;
    return {
      ...hit,
      attrValue,
      attrDamage,
      bucket: hit.bucket
    };
  });

  const attrDamageSum = resolvedHits.reduce((sum, hit) => sum + hit.attrDamage, 0);
  // DoTs from talents/passives usually scale from attr only (no WD per tick).
  const includeWeaponDamage =
    source === "mainHand" ||
    source === "arsenal" ||
    source === "class" ||
    (cooldown != null && skill.kind === "Weapon Skill");
  const basePerCast =
    resolvedHits.length > 0 ? (includeWeaponDamage ? wd : 0) + attrDamageSum : 0;
  const damagePerMin =
    includeInThroughput && castsPerMin != null && resolvedHits.length > 0
      ? basePerCast * castsPerMin
      : 0;
  const coeffSum = resolvedHits.reduce((sum, hit) => sum + hit.coeff, 0);
  const throughputWeight =
    includeInThroughput && castsPerMin != null && coeffSum > 0 ? coeffSum * castsPerMin : 0;

  return {
    id: skill.id,
    name: skill.name,
    kind: skill.kind,
    source,
    sourceLabel,
    runeName,
    talentPoints,
    cooldown,
    cadence,
    rateMode: rate.rateMode,
    rateNote: rate.rateNote,
    castsPerMin,
    weaponDamage: includeWeaponDamage ? wd : 0,
    hits: resolvedHits,
    coeffSum,
    attrDamageSum,
    basePerCast,
    damagePerMin,
    throughputWeight,
    parseable: resolvedHits.length > 0,
    includedInThroughput: damagePerMin > 0 || throughputWeight > 0
  };
}

function accumulate(map, key, amount) {
  if (!key || !(amount > 0)) {
    return;
  }
  map[key] = (map[key] || 0) + amount;
}

function toShareRows(totals) {
  const entries = Object.entries(totals).filter(([, value]) => value > 0);
  const sum = entries.reduce((acc, [, value]) => acc + value, 0);
  return entries
    .map(([key, value]) => ({
      key,
      value,
      share: sum > 0 ? value / sum : 0
    }))
    .sort((left, right) => right.value - left.value || left.key.localeCompare(right.key));
}

function weaponDamageForSource(source, mainHand, arsenalWeapon) {
  if (source === "arsenal") {
    return {
      avg: arsenalWeapon?.weaponDamageAvg,
      bucket: arsenalWeapon?.bucket,
      affinity: arsenalWeapon?.affinity
    };
  }
  return {
    avg: mainHand?.weaponDamageAvg,
    bucket: mainHand?.bucket,
    affinity: mainHand?.affinity
  };
}

export function resolveEffectiveSkillModifier(analysis) {
  const entries = analysis?.throughput?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  let weightedCoeff = 0;
  let weight = 0;
  for (const entry of entries) {
    if (!(entry.castsPerMin > 0) || !entry.hits?.length) {
      continue;
    }
    // Prefer hard skills (CD / class) for the Damage-analysis modifier.
    if (entry.rateMode !== "cooldown" && entry.source !== "class" && entry.source !== "mainHand" && entry.source !== "arsenal") {
      continue;
    }
    for (const hit of entry.hits) {
      weightedCoeff += hit.coeff * entry.castsPerMin;
      weight += entry.castsPerMin;
    }
  }

  if (!(weight > 0)) {
    // Fallback: any throughput entry.
    for (const entry of entries) {
      if (!(entry.castsPerMin > 0) || !entry.hits?.length) {
        continue;
      }
      for (const hit of entry.hits) {
        weightedCoeff += hit.coeff * entry.castsPerMin;
        weight += entry.castsPerMin;
      }
    }
  }

  if (!(weight > 0)) {
    return null;
  }
  return weightedCoeff / weight;
}

/**
 * Build kit analysis for the active loadout.
 */
export function analyzeWeaponKit({
  equipment,
  arsenal,
  skills = [],
  itemsById,
  attributes = null,
  className = "",
  classSkills = null,
  talents = null,
  assumptions: assumptionsInput = null
} = {}) {
  const assumptions = normalizeKitAssumptions(assumptionsInput);
  const mainHandItem = resolveItem(equipment, itemsById, "weapon");
  const arsenalItem = resolveItem(equipment, itemsById, "arsenal");
  const mainHand = summarizeWeapon(mainHandItem);
  const arsenalWeapon = summarizeWeapon(arsenalItem);
  const runesBySkillId = classSkills?.runesBySkillId ?? {};
  const pointsById = talents?.pointsById ?? {};

  const entries = [];
  const seen = new Set();
  const talentEffects = [];
  const bonuses = {
    critChanceFlat: 0,
    critBonusFlat: 0,
    extraDamageFlat: 0,
    conditionals: [],
    notes: []
  };

  function pushEntry(entry) {
    if (!entry || seen.has(`${entry.source}:${entry.id}`)) {
      return;
    }
    seen.add(`${entry.source}:${entry.id}`);
    entries.push(entry);
  }

  if (mainHandItem) {
    const meta = resolveWeaponMeta(mainHandItem);
    for (const skill of listWeaponKitSkills(skills, meta)) {
      if (skill.kind === "Weapon Passive") {
        continue;
      }
      pushEntry(
        skillEntry({
          skill,
          source: "mainHand",
          sourceLabel: `Main-hand · ${mainHand?.name || "weapon"}`,
          includeInThroughput: skill.kind === "Weapon Skill",
          weaponDamage: mainHand?.weaponDamageAvg,
          attributes,
          assumptions
        })
      );
    }
  }

  const selectedIds = Array.isArray(arsenal?.selectedIds) ? arsenal.selectedIds : [];
  if (arsenalItem && selectedIds.length) {
    const meta = resolveWeaponMeta(arsenalItem);
    const kit = listWeaponKitSkills(skills, meta);
    const byId = new Map(kit.map((skill) => [skill.id, skill]));
    for (const skillId of selectedIds) {
      const skill = byId.get(skillId) || (skills || []).find((entry) => entry.id === skillId);
      if (!skill || skill.kind === "Weapon Passive") {
        continue;
      }
      pushEntry(
        skillEntry({
          skill,
          source: "arsenal",
          sourceLabel: `Arsenal · ${arsenalWeapon?.name || "weapon"}`,
          includeInThroughput: skill.kind === "Weapon Skill",
          weaponDamage: arsenalWeapon?.weaponDamageAvg,
          attributes,
          assumptions
        })
      );
    }
  }

  const activeClassSkillIds = new Set(
    resolveActiveClassSkillIds(classSkills, skills, className)
  );
  if (className && activeClassSkillIds.size) {
    for (const skill of skills) {
      if (!activeClassSkillIds.has(skill.id)) {
        continue;
      }
      if (!CLASS_SKILL_KINDS.has(skill.kind) || !skillMatchesClass(skill, className)) {
        continue;
      }
      if (isLevel30Skill(skill) || skill.kind === "Passive") {
        continue;
      }

      const selectedRuneId = runesBySkillId[skill.id] || "";
      const selectedRune = (skill.runes || []).find((rune) => rune.id === selectedRuneId) ?? null;
      const description = mergeDescriptions(skill.description, selectedRune?.description);
      const hits = parseSkillDamageHits(description);
      if (!hits.length) {
        continue;
      }

      const isConduit = skill.kind === "Conduit";
      pushEntry(
        skillEntry({
          skill,
          source: "class",
          sourceLabel: selectedRune
            ? `Class · ${skill.kind} + ${selectedRune.name}`
            : `Class · ${skill.kind}`,
          includeInThroughput: isConduit
            ? assumptions.includeConduits
            : CLASS_THROUGHPUT_KINDS.has(skill.kind),
          weaponDamage: mainHand?.weaponDamageAvg,
          attributes,
          assumptions,
          descriptionOverride: description,
          runeName: selectedRune?.name ?? null
        })
      );
    }
  }

  for (const skill of skills) {
    if (skill.kind !== "Talent" || !skillMatchesClass(skill, className)) {
      continue;
    }
    const points = Math.max(0, Math.floor(Number(pointsById[skill.id]) || 0));
    if (points <= 0) {
      continue;
    }

    const effects = parseTalentEffects(skill.description, points);
    const hasSomething =
      effects.critChanceFlat > 0 ||
      effects.critBonusFlat > 0 ||
      effects.extraDamageFlat > 0 ||
      effects.damageHits.length > 0 ||
      effects.conditionals.length > 0 ||
      effects.notes.length > 0;

    if (hasSomething) {
      talentEffects.push({
        id: skill.id,
        name: skill.name,
        points,
        maxRank: skill.maxRank ?? 1,
        ...effects
      });

      bonuses.critChanceFlat += effects.critChanceFlat;
      bonuses.critBonusFlat += effects.critBonusFlat;
      bonuses.extraDamageFlat += effects.extraDamageFlat;

      for (const conditional of effects.conditionals) {
        const uptime = conditionUptime(assumptions, conditional.condition);
        const scaled = {
          ...conditional,
          sourceName: skill.name,
          uptime,
          critChanceFlat: (conditional.critChanceFlat || 0) * uptime,
          extraDamageFlat: (conditional.extraDamageFlat || 0) * uptime
        };
        bonuses.conditionals.push(scaled);
        bonuses.critChanceFlat += scaled.critChanceFlat || 0;
        bonuses.extraDamageFlat += scaled.extraDamageFlat || 0;
      }

      for (const note of effects.notes) {
        bonuses.notes.push(`${skill.name}: ${note}`);
      }
    }

    if (!effects.damageHits.length) {
      continue;
    }

    pushEntry(
      skillEntry({
        skill,
        source: "talent",
        sourceLabel: `Talent · ${points}/${skill.maxRank ?? 1}`,
        includeInThroughput: assumptions.includeTalentDamage,
        weaponDamage: mainHand?.weaponDamageAvg,
        attributes,
        assumptions,
        talentPoints: points
      })
    );
  }

  const attrThroughput = {};
  const typeThroughput = {};
  const bucketThroughput = {};
  const attrDamage = {};
  const typeDamage = {};
  const bucketDamage = {};
  const attrComposition = {};
  const typeComposition = {};
  const bucketComposition = {};

  let totalDamagePerMin = 0;
  let totalWeaponDamagePerMin = 0;

  for (const entry of entries) {
    for (const hit of entry.hits) {
      accumulate(attrComposition, hit.attr, hit.coeff);
      accumulate(typeComposition, hit.type, hit.coeff);
      accumulate(bucketComposition, hit.bucket, hit.coeff);

      if (entry.includedInThroughput && entry.castsPerMin != null) {
        const coeffWeight = hit.coeff * entry.castsPerMin;
        accumulate(attrThroughput, hit.attr, coeffWeight);
        accumulate(typeThroughput, hit.type, coeffWeight);
        accumulate(bucketThroughput, hit.bucket, coeffWeight);

        const hitDamagePerMin = hit.attrDamage * entry.castsPerMin;
        accumulate(attrDamage, hit.attr, hitDamagePerMin);
        accumulate(typeDamage, hit.type, hitDamagePerMin);
        accumulate(bucketDamage, hit.bucket, hitDamagePerMin);
      }
    }

    if (entry.includedInThroughput && entry.castsPerMin != null && entry.hits.length > 0) {
      const wdMeta = weaponDamageForSource(entry.source, mainHand, arsenalWeapon);
      const wdPerMin = entry.weaponDamage * entry.castsPerMin;
      totalWeaponDamagePerMin += wdPerMin;
      totalDamagePerMin += entry.damagePerMin;

      if (entry.weaponDamage > 0) {
        if (wdMeta.bucket) {
          accumulate(bucketDamage, wdMeta.bucket, wdPerMin);
        }
        if (wdMeta.affinity) {
          accumulate(typeDamage, wdMeta.affinity, wdPerMin);
        }
      }
    }
  }

  const parseable = entries.filter((entry) => entry.parseable);
  const throughputEntries = entries.filter((entry) => entry.includedInThroughput);
  const softThroughput = throughputEntries.filter((entry) => entry.rateMode !== "cooldown");
  const unparsed = entries.filter((entry) => !entry.parseable);
  const effectiveModifier = resolveEffectiveSkillModifier({
    throughput: { entries: throughputEntries }
  });

  return {
    mainHand,
    arsenalWeapon,
    assumptions,
    entries,
    parseableCount: parseable.length,
    unparsed,
    softThroughput,
    talentEffects,
    bonuses,
    effectiveModifier,
    hasAttributes: Boolean(attributes),
    throughput: {
      entries: throughputEntries,
      byAttribute: toShareRows(attrThroughput),
      byType: toShareRows(typeThroughput),
      byBucket: toShareRows(bucketThroughput),
      damageByAttribute: toShareRows(attrDamage),
      damageByType: toShareRows(typeDamage),
      damageByBucket: toShareRows(bucketDamage),
      totalWeight: Object.values(attrThroughput).reduce((sum, value) => sum + value, 0),
      totalDamagePerMin,
      totalWeaponDamagePerMin,
      totalAttrDamagePerMin: Math.max(0, totalDamagePerMin - totalWeaponDamagePerMin)
    },
    composition: {
      byAttribute: toShareRows(attrComposition),
      byType: toShareRows(typeComposition),
      byBucket: toShareRows(bucketComposition)
    }
  };
}
