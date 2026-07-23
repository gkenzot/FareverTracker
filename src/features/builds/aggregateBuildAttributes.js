/**
 * Aggregate combat attributes from character base (L25) + equipped gear (+ adornments).
 * Temporary buffs and skill-only helmet/weapon additives are ignored.
 */
import { getCharacterBaseStatTotals, normalizeCharacterClassKey } from "./characterBaseStats";
import {
  ARMOR_PEN_RATING_PER_PERCENT,
  CRIT_CHANCE_RATING_PER_PERCENT,
  FERVOR_RATING_PER_PERCENT,
  ratingToPercent
} from "./damageFormulas";
import {
  EQUIPMENT_SLOTS,
  findAugmentByName,
  getAdornmentFieldsForSlot,
  getAugmentDisplayName,
  getDefaultUsedRarity,
  isWeaponEquipmentSlot,
  isOffHandOnlyWeapon,
  resolveSlotAdornments,
  resolveUsedLevel,
  resolveUsedRarity,
  resolveUsedUpgradeLevel
} from "./buildSlots";
import { scaleItemStats, applyArsenalStatFactor } from "./gearStatScaling";
import { resolveWeaponUpgradeBonusSheetEffects } from "./weaponUpgradeBonuses";

/** Crit damage multiplier before Strength/Faith contribution (soft-cap asymptote floor). */
const BASE_CRITICAL_BONUS = 1.5;

/** Soft-cap: bonus = BASE + C * (Str+Faith) / ((Str+Faith) + K). Fit: Practice 151.6% + Kek 152.6%. */
const CRIT_BONUS_SOFT_CAP_C = 0.0576;
const CRIT_BONUS_SOFT_CAP_K = 205.4;

/** Naked Warrior L25: +0.1% crit chance per Dex or Int. */
const CRIT_CHANCE_PER_DEX_OR_INT = 0.001;

/** Flat crit chance with no Dex/Int (naked sheet residual ≈ 0.2%). */
const BASE_CRITICAL_CHANCE = 0.002;

/** Vitality → Max Health. */
const MAX_HEALTH_PER_VITALITY = 3;

/**
 * Health regen soft-cap on total Vitality (not ΔVit).
 * Fit: naked 1.1 @38, Beefury 1.6 @70, Kek 2.6 @169.
 */
const HEALTH_REGEN_SOFT_A = 0.301;
const HEALTH_REGEN_SOFT_B = 5.047;
const HEALTH_REGEN_SOFT_K = 202;

/** Block chance from equipped main-hand weapon (Arsenal ignored). */
const BLOCK_CHANCE_FROM_WEAPON = 0.5;

/** Block chance from equipped shield (wins over weapon if both). */
const BLOCK_CHANCE_FROM_SHIELD = 0.6;

function resolveEquippedItemStats(item, slotKey, slotValue, characterClassName) {
  const allowRarityOverride = isWeaponEquipmentSlot(slotKey);
  const rarity = allowRarityOverride
    ? resolveUsedRarity(slotValue, item) || "Rare"
    : getDefaultUsedRarity(item) || "Rare";
  const upgradeLevel = allowRarityOverride
    ? resolveUsedUpgradeLevel(slotValue, rarity)
    : 0;

  const stats = scaleItemStats(item, {
    level: resolveUsedLevel(slotValue, item),
    rarity,
    upgradeLevel,
    characterClassName
  });

  if (slotKey !== "arsenal") {
    return stats;
  }

  return applyArsenalStatFactor(stats);
}

function resolveBlockChance(equipment, itemsById) {
  let block = 0;
  const main = equipment?.weapon;
  if (main?.itemId) {
    const item = itemsById?.get?.(main.itemId);
    if (item && !isOffHandOnlyWeapon(item)) {
      block = Math.max(block, BLOCK_CHANCE_FROM_WEAPON);
    }
  }

  const off = equipment?.secondaryWeapon;
  if (off?.itemId) {
    const item = itemsById?.get?.(off.itemId);
    if (item && isOffHandOnlyWeapon(item)) {
      block = Math.max(block, BLOCK_CHANCE_FROM_SHIELD);
    }
  }

  return block;
}

function addStat(totals, label, value) {
  const amount = Number(value);
  if (!label || !Number.isFinite(amount) || amount === 0) {
    return;
  }
  totals[label] = (totals[label] ?? 0) + amount;
}

function mergeStatTotals(into, from) {
  if (!from) {
    return into;
  }
  for (const [label, value] of Object.entries(from)) {
    addStat(into, label, value);
  }
  return into;
}

/** Sum raw gear/adornment stat labels for one equipment set. */
function aggregateEquipmentStatTotals(equipment, itemsById, augments = [], characterClassName = "") {
  const totals = Object.create(null);
  /** Identical cursed-eye Critical penalties do not stack (Kek: −9 once → crit 11.5%). */
  const appliedNegativeCritAugments = new Set();

  for (const slot of EQUIPMENT_SLOTS) {
    const slotValue = equipment?.[slot.key];
    const itemId = slotValue?.itemId;
    if (!itemId) {
      continue;
    }

    const item = itemsById?.get?.(itemId);
    if (!item) {
      continue;
    }

    for (const stat of resolveEquippedItemStats(item, slot.key, slotValue, characterClassName)) {
      addStat(totals, stat.label, stat.value);
    }

    const adornments = resolveSlotAdornments(slot.key, slotValue?.adornments);
    for (const field of getAdornmentFieldsForSlot(slot.key)) {
      const rawName = adornments[field.key];
      if (!rawName) {
        continue;
      }
      const augment = findAugmentByName(augments, rawName, field.key);
      if (!augment?.stats?.length) {
        continue;
      }
      const augmentKey = String(augment.id || getAugmentDisplayName(augment) || rawName);
      for (const stat of augment.stats) {
        if (stat.label === "Critical" && Number(stat.value) < 0) {
          if (appliedNegativeCritAugments.has(augmentKey)) {
            continue;
          }
          appliedNegativeCritAugments.add(augmentKey);
        }
        addStat(totals, stat.label, stat.value);
      }
    }
  }

  return totals;
}

function roundStat(value, digits = 2) {
  const number = Number(value) || 0;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

/**
 * Derived combat attributes shown in the Attributes panel.
 * Values are final sheet-style numbers (percents as 0–1 fractions, multipliers as e.g. 1.52).
 */
function deriveBuildAttributes(totals = {}, characterClassName = "") {
  const strength = Number(totals.Strength) || 0;
  const dexterity = Number(totals.Dexterity) || 0;
  const intellect = Number(totals.Intellect) || 0;
  const faith = Number(totals.Faith) || 0;
  const vitality = Number(totals.Vitality) || 0;
  const critRating = Number(totals.Critical) || 0;
  const armorPenRating = Number(totals["Armor Penetration"]) || 0;
  const magicPenRating = Number(totals["Magic Penetration"]) || 0;
  const fervorRating = Number(totals.Fervor) || 0;
  const armor = Number(totals.Armor) || 0;
  const maxHealthFlat = Number(totals["Max Health"]) || 0;

  const criticalChance =
    BASE_CRITICAL_CHANCE +
    ratingToPercent(critRating, CRIT_CHANCE_RATING_PER_PERCENT) +
    dexterity * CRIT_CHANCE_PER_DEX_OR_INT +
    intellect * CRIT_CHANCE_PER_DEX_OR_INT;

  const primaryPower = Math.max(0, strength + faith);
  const criticalBonus =
    BASE_CRITICAL_BONUS +
    (CRIT_BONUS_SOFT_CAP_C * primaryPower) / (primaryPower + CRIT_BONUS_SOFT_CAP_K);

  const healthRegen =
    HEALTH_REGEN_SOFT_A + (HEALTH_REGEN_SOFT_B * vitality) / (vitality + HEALTH_REGEN_SOFT_K);

  return {
    vitality: Math.round(vitality),
    strength: Math.round(strength),
    dexterity: Math.round(dexterity),
    intellect: Math.round(intellect),
    faith: Math.round(faith),
    criticalChance: roundStat(criticalChance, 4),
    criticalBonus: roundStat(criticalBonus, 4),
    armorPenetration: roundStat(ratingToPercent(armorPenRating, ARMOR_PEN_RATING_PER_PERCENT), 4),
    magicPenetration: roundStat(ratingToPercent(magicPenRating, ARMOR_PEN_RATING_PER_PERCENT), 4),
    fervor: roundStat(ratingToPercent(fervorRating, FERVOR_RATING_PER_PERCENT), 4),
    block: roundStat(Number(totals.Block) || 0, 2),
    dodgeChance: roundStat(Number(totals["Dodge Chance"] ?? totals.Dodge) || 0, 4),
    magicMastery: roundStat(Number(totals["Magic Mastery"]) || 0, 2),
    physicalMastery: roundStat(Number(totals["Physical Mastery"]) || 0, 2),
    armor: Math.round(armor),
    maximumHealth: Math.round(maxHealthFlat + vitality * MAX_HEALTH_PER_VITALITY),
    healthRegen: roundStat(healthRegen, 2),
    _raw: {
      strength,
      dexterity,
      intellect,
      faith,
      vitality,
      critRating,
      armorPenRating,
      magicPenRating,
      fervorRating
    }
  };
}

function primaryFromTotals(totals) {
  const source = totals ?? {};
  return {
    vitality: Math.round(Number(source.Vitality) || 0),
    strength: Math.round(Number(source.Strength) || 0),
    dexterity: Math.round(Number(source.Dexterity) || 0),
    faith: Math.round(Number(source.Faith) || 0),
    intellect: Math.round(Number(source.Intellect) || 0)
  };
}

function resolveWeaponUpgradeSheetBonuses(equipment, itemsById) {
  const effects = Object.create(null);

  for (const slot of EQUIPMENT_SLOTS) {
    if (!isWeaponEquipmentSlot(slot.key)) {
      continue;
    }
    const slotValue = equipment?.[slot.key];
    const itemId = slotValue?.itemId;
    if (!itemId) {
      continue;
    }
    const item = itemsById?.get?.(itemId);
    if (!item) {
      continue;
    }

    const rarity = resolveUsedRarity(slotValue, item) || "Rare";
    const upgradeLevel = resolveUsedUpgradeLevel(slotValue, rarity);
    const slotEffects = resolveWeaponUpgradeBonusSheetEffects(item, { rarity, upgradeLevel });
    for (const [key, value] of Object.entries(slotEffects)) {
      effects[key] = (effects[key] || 0) + value;
    }
  }

  return effects;
}

function applySheetBonusEffects(attributes, effects) {
  if (!effects || !Object.keys(effects).length) {
    return attributes;
  }

  const next = { ...attributes };
  for (const [key, value] of Object.entries(effects)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      continue;
    }
    // Mastery rows are shown as whole percents (5 = 5%); other combat rows use 0–1 fractions.
    const amount = key === "magicMastery" || key === "physicalMastery" ? value * 100 : value;
    next[key] = roundStat((Number(next[key]) || 0) + amount, 4);
  }
  return next;
}

export function aggregateBuildAttributes(equipment, itemsById, augments = [], characterClassName = "") {
  const gearTotals = aggregateEquipmentStatTotals(equipment, itemsById, augments, characterClassName);
  const baseTotals = getCharacterBaseStatTotals(characterClassName);
  const totals = Object.create(null);
  mergeStatTotals(totals, gearTotals);
  mergeStatTotals(totals, baseTotals);
  const derived = deriveBuildAttributes(totals, characterClassName);
  const upgradeBonuses = resolveWeaponUpgradeSheetBonuses(equipment, itemsById);
  const withUpgrades = applySheetBonusEffects(derived, upgradeBonuses);
  return {
    ...withUpgrades,
    block: roundStat(resolveBlockChance(equipment, itemsById), 2),
    _breakdown: {
      base: primaryFromTotals(baseTotals),
      gear: primaryFromTotals(gearTotals),
      weaponUpgrades: upgradeBonuses
    }
  };
}

export const BUILD_ATTRIBUTE_ROWS = [
  { key: "vitality", label: "Vitality", format: "number" },
  { key: "strength", label: "Strength", format: "number" },
  { key: "dexterity", label: "Dexterity", format: "number" },
  { key: "faith", label: "Faith", format: "number" },
  { key: "intellect", label: "Intellect", format: "number" },
  { key: "criticalChance", label: "Critical chance", format: "percent" },
  { key: "criticalBonus", label: "Critical Bonus", format: "multiplier" },
  { key: "armorPenetration", label: "Armor penetration", format: "percent" },
  { key: "magicPenetration", label: "Magic penetration", format: "percent" },
  { key: "fervor", label: "Fervor", format: "percent" },
  { key: "block", label: "Block", format: "percent" },
  { key: "dodgeChance", label: "Dodge chance", format: "percent" },
  { key: "magicMastery", label: "Magic mastery", format: "number" },
  { key: "physicalMastery", label: "Physical mastery", format: "number" },
  { key: "armor", label: "Armor", format: "number" },
  { key: "maximumHealth", label: "Maximum health", format: "number" },
  { key: "healthRegen", label: "Health regen", format: "number" }
];

/** Class main attribute for gear tooltip / item config ordering. */
export const CLASS_PRIMARY_ATTRIBUTE = {
  warrior: "Strength",
  rogue: "Dexterity",
  mage: "Intellect",
  priest: "Faith"
};

const GEAR_STAT_ORDER_TAIL = [
  "Critical",
  "Armor Penetration",
  "Magic Penetration",
  "Fervor"
];

/**
 * Item stat display order:
 * Armor → Vitality → class primary → other attrs → Critical → pens → Fervor → rest.
 */
export function sortGearStatsForDisplay(stats = [], className = "") {
  const classKey = normalizeCharacterClassKey(className);
  const primaryLabel = CLASS_PRIMARY_ATTRIBUTE[classKey] || "";
  const primaryOrder = ["Strength", "Dexterity", "Faith", "Intellect"];
  const otherPrimaries = primaryOrder.filter((label) => label !== primaryLabel);

  const rankOf = (label) => {
    const value = String(label ?? "").trim();
    if (/^armor$/i.test(value)) return 0;
    if (/^vitality$/i.test(value)) return 1;
    if (primaryLabel && value.toLowerCase() === primaryLabel.toLowerCase()) return 2;
    const otherIndex = otherPrimaries.findIndex((name) => name.toLowerCase() === value.toLowerCase());
    if (otherIndex >= 0) return 3 + otherIndex;
    const tailIndex = GEAR_STAT_ORDER_TAIL.findIndex((name) => name.toLowerCase() === value.toLowerCase());
    if (tailIndex >= 0) return 10 + tailIndex;
    return 100;
  };

  return [...stats].sort((left, right) => {
    const rankDelta = rankOf(left.label) - rankOf(right.label);
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return String(left.label).localeCompare(String(right.label));
  });
}
