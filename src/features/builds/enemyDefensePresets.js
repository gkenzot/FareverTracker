/**
 * Enemy defense from Farever Calculator.ods.
 * Confirmed note: "Level 20 Bosses have 1,500 Armor" → 75 armor per level.
 */

const BOSS_ARMOR_PER_LEVEL = 75;
export const BOSS_LEVEL_MIN = 1;
export const BOSS_LEVEL_MAX = 25;
export const DEFAULT_BOSS_LEVEL = 25;

/** Armor = level × 75 (L20 = 1500). */
export function bossArmorAtLevel(level) {
  const lvl = Number(level);
  if (!Number.isFinite(lvl) || lvl <= 0) {
    return 0;
  }
  return Math.round(lvl * BOSS_ARMOR_PER_LEVEL);
}

/** Named encounters from Armor Tests (labels only — armor comes from level). */
const BOSS_NAMES_BY_LEVEL = {
  1: ["Crab"],
  10: ["Skunk", "Ratsar"],
  13: ["Lady Bee"],
  17: ["Farmhand", "Coyote"],
  20: ["Ratsar", "Lady Bee", "Crabgantua"]
};

export function bossNamesAtLevel(level) {
  return BOSS_NAMES_BY_LEVEL[Number(level)] ?? [];
}
