/**
 * Naked character sheet baselines. Level is fixed at EA cap (25) for now.
 * Fill each class from in-game naked screenshots (no buffs).
 */
import { ARMOR_PEN_RATING_PER_PERCENT, percentToRating } from "./damageFormulas";

const FIXED_CHARACTER_LEVEL = 25;

const CLASS_ALIASES = {
  warrior: ["warrior", "fighter"],
  rogue: ["rogue", "assassin"],
  mage: ["mage", "wizard"],
  priest: ["priest", "cleric"]
};

/**
 * Primary + combat baselines at {@link FIXED_CHARACTER_LEVEL}, naked.
 * `null` = not measured yet (gear-only until filled).
 *
 * Percent combat fields use sheet fractions (0.10 = 10%).
 * Pen/Fervor are converted to rating when merged into totals.
 */
const BASE_BY_CLASS = {
  warrior: {
    vitality: 38,
    strength: 34,
    dexterity: 28,
    faith: 28,
    intellect: 28,
    dodgeChance: 0.003,
    healthRegen: 1.1,
    armorPenetration: 0,
    magicPenetration: 0,
    fervor: 0
  },
  mage: {
    vitality: 32,
    strength: 34,
    dexterity: 34,
    faith: 34,
    intellect: 40,
    dodgeChance: 0.003,
    healthRegen: 1.4,
    armorPenetration: 0,
    magicPenetration: 0.1,
    fervor: 0
  },
  rogue: {
    vitality: 32,
    strength: 34,
    dexterity: 40,
    faith: 34,
    intellect: 34,
    dodgeChance: 0.004,
    healthRegen: 1.4,
    armorPenetration: 0,
    magicPenetration: 0,
    fervor: 0
  },
  priest: {
    vitality: 38,
    strength: 28,
    dexterity: 28,
    faith: 34,
    intellect: 28,
    dodgeChance: 0.003,
    healthRegen: 1.4,
    armorPenetration: 0,
    magicPenetration: 0,
    fervor: 0
  }
};

export function normalizeCharacterClassKey(className) {
  const normalized = String(className ?? "")
    .trim()
    .toLowerCase();

  for (const [canonical, aliases] of Object.entries(CLASS_ALIASES)) {
    if (aliases.includes(normalized)) {
      return canonical;
    }
  }

  return normalized || "";
}

/**
 * @returns {(typeof BASE_BY_CLASS)[keyof typeof BASE_BY_CLASS] & { level: number }} | null}
 */
function getCharacterBaseStats(className) {
  const key = normalizeCharacterClassKey(className);
  const base = BASE_BY_CLASS[key];
  if (!base) {
    return null;
  }

  return {
    level: FIXED_CHARACTER_LEVEL,
    ...base
  };
}

/** Flat label totals to merge before deriving sheet attributes. */
export function getCharacterBaseStatTotals(className) {
  const base = getCharacterBaseStats(className);
  if (!base) {
    return null;
  }

  const totals = {
    Vitality: base.vitality,
    Strength: base.strength,
    Dexterity: base.dexterity,
    Faith: base.faith,
    Intellect: base.intellect,
    "Dodge Chance": base.dodgeChance,
    "Health Regen": base.healthRegen
  };

  if (base.armorPenetration) {
    totals["Armor Penetration"] = percentToRating(base.armorPenetration, ARMOR_PEN_RATING_PER_PERCENT);
  }
  if (base.magicPenetration) {
    totals["Magic Penetration"] = percentToRating(base.magicPenetration, ARMOR_PEN_RATING_PER_PERCENT);
  }

  return totals;
}
