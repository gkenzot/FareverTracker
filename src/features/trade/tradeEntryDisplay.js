import { sortGearStatsForDisplay } from "../builds/aggregateBuildAttributes";
import {
  createEmptyAdornments,
  findAugmentByName,
  getAdornmentFieldsForSlot,
  getAugmentDisplayName,
  getDefaultUsedLevel,
  getDefaultUsedRarity,
  isFixedCraftLevelItem,
  isWeaponEquipmentSlot,
  resolveSlotAdornments,
  resolveUsedLevel,
  resolveUsedRarity,
  resolveUsedUpgradeLevel
} from "../builds/buildSlots";
import { scaleItemStats } from "../builds/gearStatScaling";
import {
  parseWeaponUpgradeBonusSheetEffects,
  resolveWeaponUpgradeBonus,
  WEAPON_UPGRADE_BONUS_MIN_LEVEL
} from "../builds/weaponUpgradeBonuses";
import {
  getTradeEntryDetailLines,
  inferTradeSlotKey,
  isConfigurableTradeCollection,
  tradeEntryToSlotValue
} from "./tradeConstants";

export function formatStatLine(stat) {
  const value = Number(stat?.value);
  if (!Number.isFinite(value)) {
    return String(stat?.label ?? "");
  }
  const signed = value > 0 ? `+${value}` : String(value);
  if (stat?.unit === "%") {
    return `${signed}% ${stat.label}`;
  }
  return `${signed} ${stat.label}`;
}

function getWeaponDamageLine(item) {
  const weaponDamage = item?.weaponDamage;
  if (!weaponDamage || !Number.isFinite(Number(weaponDamage.avg))) {
    return null;
  }

  const avg = Number(weaponDamage.avg);
  const min = Number(weaponDamage.min);
  const max = Number(weaponDamage.max);
  const hasRange = Number.isFinite(min) && Number.isFinite(max);
  const value = hasRange
    ? `${min}–${max}${weaponDamage.affinity ? ` · ${weaponDamage.affinity}` : ""}`
    : `${avg}${weaponDamage.affinity ? ` · ${weaponDamage.affinity}` : ""}`;

  return `Weapon Damage ${value}`;
}

function getUpgradeBonusBlock(item, { rarity, upgradeLevel }) {
  const bonus = resolveWeaponUpgradeBonus(item, { rarity, upgradeLevel });
  if (!bonus?.active) {
    return null;
  }

  const sheetEffects = parseWeaponUpgradeBonusSheetEffects(bonus.text);
  const stats = Object.entries(sheetEffects).map(([key, fraction]) => ({
    label:
      key === "criticalChance"
        ? "Critical Chance"
        : key === "armorPenetration"
          ? "Armor Penetration"
          : key === "magicPenetration"
            ? "Magic Penetration"
            : key === "magicMastery"
              ? "Magic Mastery"
              : key === "physicalMastery"
                ? "Physical Mastery"
                : key === "fervor"
                  ? "Fervor"
                  : key,
    value: Math.round((Number(fraction) || 0) * 1000) / 10,
    unit: "%"
  }));

  return {
    label: `Upgrade Bonus ★${WEAPON_UPGRADE_BONUS_MIN_LEVEL}+`,
    description: String(bonus.text ?? "").trim(),
    stats
  };
}

function getAdornmentBlocks(slotKey, adornments, augments = []) {
  const resolved = resolveSlotAdornments(slotKey, adornments);
  const blocks = [];

  for (const field of getAdornmentFieldsForSlot(slotKey)) {
    const rawName = resolved[field.key];
    if (!rawName) {
      continue;
    }

    const augment = findAugmentByName(augments, rawName, field.key);
    blocks.push({
      key: field.key,
      label: field.label,
      name: augment ? getAugmentDisplayName(augment) : rawName,
      description: String(augment?.description ?? "").trim(),
      stats: Array.isArray(augment?.stats) ? augment.stats : []
    });
  }

  return blocks;
}

/** Full Buy/Sell card model: meta, stats, adornment/upgrade descriptions. */
export function getTradeEntryCardModel(entry, item = null, augments = [], characterClassName = "") {
  const metaLines = getTradeEntryDetailLines(entry, item);

  if (!entry || !item || !isConfigurableTradeCollection(entry.collectionKey)) {
    return {
      metaLines,
      weaponDamage: null,
      stats: [],
      adornments: [],
      upgradeBonus: null
    };
  }

  const slotKey = inferTradeSlotKey(item, entry.collectionKey);
  const slotValue = tradeEntryToSlotValue(entry);
  const crafted = isFixedCraftLevelItem(item);
  const showWeaponControls = (isWeaponEquipmentSlot(slotKey) || Boolean(item.weaponDamage)) && !crafted;
  const effectiveLevel = resolveUsedLevel(slotValue, item) ?? getDefaultUsedLevel(item);
  const effectiveRarity = showWeaponControls
    ? resolveUsedRarity(slotValue, item)
    : getDefaultUsedRarity(item);
  const effectiveUpgrade = showWeaponControls ? resolveUsedUpgradeLevel(slotValue, effectiveRarity) : 0;

  const stats = sortGearStatsForDisplay(
    scaleItemStats(item, {
      level: effectiveLevel,
      rarity: effectiveRarity,
      upgradeLevel: effectiveUpgrade,
      characterClassName
    }),
    characterClassName
  );

  const adornments = getAdornmentBlocks(
    slotKey,
    {
      ...createEmptyAdornments(),
      ...(entry.adornments && typeof entry.adornments === "object" ? entry.adornments : {})
    },
    augments
  );

  const upgradeBonus = showWeaponControls
    ? getUpgradeBonusBlock(item, { rarity: effectiveRarity, upgradeLevel: effectiveUpgrade })
    : null;

  const adornmentLabels = new Set(adornments.map((block) => block.label));
  const filteredMeta = metaLines.filter((line) => !adornmentLabels.has(line.label));

  return {
    metaLines: filteredMeta,
    weaponDamage: getWeaponDamageLine(item),
    stats,
    adornments,
    upgradeBonus
  };
}
