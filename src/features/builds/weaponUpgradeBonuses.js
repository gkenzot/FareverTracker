/**
 * Passive unlocked when a weapon reaches upgrade level 3+ (★3).
 * Values scale with selected rarity (Rare / Epic / Legendary).
 * Source: https://farever.wiki/Upgrade_Station
 */

const BY_NAME = {
  "Ghost Clams of the Low Tide": {
    Rare: "Attacks have 5% chance to reduce weapon skill cooldowns by 0.5s",
    Epic: "Attacks have 6% chance to reduce weapon skill cooldowns by 0.5s",
    Legendary: "Attacks have 7% chance to reduce weapon skill cooldowns by 0.5s"
  },
  "Flame of Argol": {
    Rare: "Magic Penetration +5%",
    Epic: "Magic Penetration +6%",
    Legendary: "Magic Penetration +7%"
  },
  "Twin Fangs of Ratsar": {
    Rare: "Base attack damage from behind +10%",
    Epic: "Base attack damage from behind +12%",
    Legendary: "Base attack damage from behind +14%"
  },
  Thornlace: {
    Rare: "Damage +10% when surrounded by 3+ enemies",
    Epic: "Damage +12% when surrounded by 3+ enemies",
    Legendary: "Damage +14% when surrounded by 3+ enemies"
  },
  "Ipheion, Star Blossom": {
    Rare: "Attacks against enemies 20m+ away gain +5% crit chance",
    Epic: "Attacks against enemies 20m+ away gain +6% crit chance",
    Legendary: "Attacks against enemies 20m+ away gain +7% crit chance"
  },
  "Book of Mi'Mizan": {
    Rare: "Magic Mastery +5%",
    Epic: "Magic Mastery +6%",
    Legendary: "Magic Mastery +7%"
  },
  Radiance: {
    Rare: "Cooldown Reduction +3%",
    Epic: "Cooldown Reduction +4%",
    Legendary: "Cooldown Reduction +5%"
  },
  Clawdius: {
    Rare: "Physical Mastery +5%",
    Epic: "Physical Mastery +6%",
    Legendary: "Physical Mastery +7%"
  },
  "Ramulus & Ramus": {
    Rare: "Physical Mastery +5%",
    Epic: "Physical Mastery +6%",
    Legendary: "Physical Mastery +7%"
  },
  "Horns of the Wind": {
    Rare: "Base attack damage against enemies 20m+ away +10%",
    Epic: "Base attack damage against enemies 20m+ away +12%",
    Legendary: "Base attack damage against enemies 20m+ away +14%"
  },
  Credence: {
    Rare: "Base attack damage against enemies 20m+ away +10%",
    Epic: "Base attack damage against enemies 20m+ away +12%",
    Legendary: "Base attack damage against enemies 20m+ away +14%"
  },
  "Lady Bee’s Ceremonial Stinger": {
    Rare: "Armor Penetration +5%",
    Epic: "Armor Penetration +6%",
    Legendary: "Armor Penetration +7%"
  },
  "Lady Bee's Ceremonial Stinger": {
    Rare: "Armor Penetration +5%",
    Epic: "Armor Penetration +6%",
    Legendary: "Armor Penetration +7%"
  },
  "Gorgon Ratsay’s Toothpick": {
    Rare: "Armor Penetration +5%",
    Epic: "Armor Penetration +6%",
    Legendary: "Armor Penetration +7%"
  },
  "Gorgon Ratsay's Toothpick": {
    Rare: "Armor Penetration +5%",
    Epic: "Armor Penetration +6%",
    Legendary: "Armor Penetration +7%"
  },
  "Iron Fins of the Leviathan": {
    Rare: "Critical Chance +2%",
    Epic: "Critical Chance +3%",
    Legendary: "Critical Chance +4%"
  },
  "Cheese Moon": {
    Rare: "Critical Chance +2%",
    Epic: "Critical Chance +3%",
    Legendary: "Critical Chance +4%"
  },
  Judgement: {
    Rare: "Critical Chance +2%",
    Epic: "Critical Chance +3%",
    Legendary: "Critical Chance +4%"
  },
  Worldsplitter: {
    Rare: "Critical Chance +2%",
    Epic: "Critical Chance +3%",
    Legendary: "Critical Chance +4%"
  },
  "Crabgantua's Kneecap": {
    Rare: "Damage taken -7%",
    Epic: "Damage taken -9%",
    Legendary: "Damage taken -11%"
  },
  Dominion: {
    Rare: "Damage taken -7%",
    Epic: "Damage taken -9%",
    Legendary: "Damage taken -11%"
  },
  "Magma Mia": {
    Rare: "Damage taken -7%",
    Epic: "Damage taken -9%",
    Legendary: "Damage taken -11%"
  },
  "Pocket Hive": {
    Rare: "Base attacks have 5% chance to stun enemies for 2s",
    Epic: "Base attacks have 6% chance to stun enemies for 2s",
    Legendary: "Base attacks have 7% chance to stun enemies for 2s"
  },
  "Twin Pillars of Justice": {
    Rare: "Base attacks have 5% chance to stun enemies for 2s",
    Epic: "Base attacks have 6% chance to stun enemies for 2s",
    Legendary: "Base attacks have 7% chance to stun enemies for 2s"
  },
  "Amon Ram, the Creator": {
    Rare: "Base attacks have 5% chance to stun enemies for 2s",
    Epic: "Base attacks have 6% chance to stun enemies for 2s",
    Legendary: "Base attacks have 7% chance to stun enemies for 2s"
  },
  Wingsabers: {
    Rare: "Base attacks have 5% chance to attack twice",
    Epic: "Base attacks have 6% chance to attack twice",
    Legendary: "Base attacks have 7% chance to attack twice"
  },
  "Beefury, Blessed Blade of the Farseeker": {
    Rare: "Base attacks have 5% chance to attack twice",
    Epic: "Base attacks have 6% chance to attack twice",
    Legendary: "Base attacks have 7% chance to attack twice"
  },
  Glory: {
    Rare: "Base attacks have 5% chance to attack twice",
    Epic: "Base attacks have 6% chance to attack twice",
    Legendary: "Base attacks have 7% chance to attack twice"
  }
};

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ");
}

const BY_NORMALIZED = new Map(
  Object.entries(BY_NAME).map(([name, bonuses]) => [normalizeName(name), bonuses])
);

export const WEAPON_UPGRADE_BONUS_MIN_LEVEL = 3;

export function getWeaponUpgradeBonusTable(item) {
  if (!item) {
    return null;
  }
  return BY_NORMALIZED.get(normalizeName(item.name)) || null;
}

/**
 * @returns {{ text: string, rarity: string, active: boolean } | null}
 */
export function resolveWeaponUpgradeBonus(item, { rarity = "Rare", upgradeLevel = 0 } = {}) {
  const table = getWeaponUpgradeBonusTable(item);
  if (!table) {
    return null;
  }
  const rarityKey = ["Legendary", "Epic", "Rare"].find(
    (option) => option.toLowerCase() === String(rarity || "Rare").toLowerCase()
  );
  const text = (rarityKey && table[rarityKey]) || table.Rare || null;
  if (!text) {
    return null;
  }
  return {
    text,
    rarity: rarityKey || "Rare",
    active: Number(upgradeLevel) >= WEAPON_UPGRADE_BONUS_MIN_LEVEL
  };
}

/** Sheet-facing flat bonuses parsed from ★3+ upgrade text (fractions, e.g. 0.03 = +3%). */
const SHEET_BONUS_PATTERNS = [
  { key: "criticalChance", pattern: /critical\s*chance\s*\+(\d+(?:\.\d+)?)\s*%/i },
  { key: "armorPenetration", pattern: /armor\s*penetration\s*\+(\d+(?:\.\d+)?)\s*%/i },
  { key: "magicPenetration", pattern: /magic\s*penetration\s*\+(\d+(?:\.\d+)?)\s*%/i },
  { key: "magicMastery", pattern: /magic\s*mastery\s*\+(\d+(?:\.\d+)?)\s*%/i },
  { key: "physicalMastery", pattern: /physical\s*mastery\s*\+(\d+(?:\.\d+)?)\s*%/i },
  { key: "fervor", pattern: /fervor\s*\+(\d+(?:\.\d+)?)\s*%/i }
];

/**
 * @returns {Partial<Record<string, number>>}
 */
export function parseWeaponUpgradeBonusSheetEffects(text) {
  const effects = Object.create(null);
  const source = String(text || "");
  if (!source) {
    return effects;
  }

  for (const { key, pattern } of SHEET_BONUS_PATTERNS) {
    const match = source.match(pattern);
    if (!match) {
      continue;
    }
    const percent = Number(match[1]);
    if (!Number.isFinite(percent) || percent === 0) {
      continue;
    }
    effects[key] = (effects[key] || 0) + percent / 100;
  }

  return effects;
}

/**
 * Active ★3+ upgrade effects that modify the Attributes panel.
 * Arsenal passives apply at full strength (only base item stats are “broken”).
 */
export function resolveWeaponUpgradeBonusSheetEffects(item, { rarity = "Rare", upgradeLevel = 0 } = {}) {
  const bonus = resolveWeaponUpgradeBonus(item, { rarity, upgradeLevel });
  if (!bonus?.active) {
    return Object.create(null);
  }
  return parseWeaponUpgradeBonusSheetEffects(bonus.text);
}
